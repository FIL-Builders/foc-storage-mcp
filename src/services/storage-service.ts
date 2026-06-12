import {
  SIZE_CONSTANTS,
  TIME_CONSTANTS,
} from "@filoz/synapse-core/utils";
import { formatUnits } from "viem";
import { MAX_UINT256, env } from "@/config";
import * as ERC20 from "@filoz/synapse-core/erc20";
import * as Payments from "@filoz/synapse-core/pay";
import { getBalance } from "viem/actions";
import {
  calculateEffectiveRate,
  type getPriceList,
  getPriceList as getWarmStoragePriceList,
  getUploadCosts,
} from "@filoz/synapse-core/warm-storage";
import { getDataSetSizes } from "@filoz/synapse-core/pdp-verifier";
import { account, client, publicClient } from "@/services/viem";

type PriceListResult = getPriceList.OutputType;
type UploadCostsResult = Awaited<ReturnType<typeof getUploadCosts>>;

/**
 * Calculates storage costs per epoch, per day, and per month for a given size
 * @param prices Current service pricing from blockchain
 * @param sizeInBytes Storage size in bytes
 * @returns Object containing cost per epoch, per day, and per month in base units
 */
const calculateStorageCost = (priceList: PriceListResult, sizeInBytes: number) => {
  const rate = calculateEffectiveRate({
    sizeInBytes: BigInt(sizeInBytes),
    storagePerTibPerMonth: priceList.rates.storagePerTibPerMonth,
    datasetFeePerMonth: priceList.rates.datasetFeePerMonth,
    epochsPerMonth: TIME_CONSTANTS.EPOCHS_PER_MONTH,
  });

  const perEpoch = rate.ratePerEpoch
  const perDay = perEpoch * TIME_CONSTANTS.EPOCHS_PER_DAY
  const perMonth = rate.ratePerMonth
  return {
    perEpoch,
    perDay,
    perMonth,
  }
}

export interface StorageBalanceResult {
  filBalance: bigint;
  usdfcBalance: bigint;
  availableStorageFundsUsdfc: bigint;
  depositNeeded: bigint;
  availableToFreeUp: bigint;
  daysLeftAtMaxBurnRate: number;
  daysLeftAtBurnRate: number;
  isRateSufficient: boolean;
  isLockupSufficient: boolean;
  isSufficient: boolean;
  currentStorageMonthlyRate: bigint;
  maxStorageMonthlyRate: bigint;
}

export interface StorageBalanceUploadOptions {
  isNewDataSet: boolean;
  withCDN?: boolean;
  dataSetId?: bigint;
  currentDataSetSize?: bigint;
  pieceCount?: bigint;
}

export interface CheckStorageBalanceOptions {
  notificationThresholdDays?: number;
  upload?: StorageBalanceUploadOptions;
}

interface StorageBalanceResultFormatted {
  filBalance: string;
  usdfcBalance: string;
  availableStorageFundsUsdfc: string;
  currentStorageMonthlyRate: string;
  maxStorageMonthlyRate: string;
  daysLeftAtMaxBurnRate: string;
  daysLeftAtBurnRate: string;
  depositNeeded: string;
  availableToFreeUp: string;
  isRateSufficient: boolean;
  isLockupSufficient: boolean;
  isSufficient: boolean;
}

export const defaultStorageBalanceResult: StorageBalanceResult = {
  filBalance: 0n,
  usdfcBalance: 0n,
  availableStorageFundsUsdfc: 0n,
  depositNeeded: 0n,
  availableToFreeUp: 0n,
  daysLeftAtMaxBurnRate: 0,
  daysLeftAtBurnRate: 0,
  isRateSufficient: false,
  isLockupSufficient: false,
  isSufficient: false,
  currentStorageMonthlyRate: 0n,
  maxStorageMonthlyRate: 0n,
}

export const defaultStorageBalanceResultFormatted: StorageBalanceResultFormatted = {
  filBalance: "0 FIL",
  usdfcBalance: "0 USDFC",
  availableStorageFundsUsdfc: "0 USDFC",
  depositNeeded: "0 USDFC",
  availableToFreeUp: "0 USDFC",
  daysLeftAtMaxBurnRate: "0 days",
  daysLeftAtBurnRate: "0 days",
  currentStorageMonthlyRate: "0 USDFC",
  maxStorageMonthlyRate: "0 USDFC",
  isRateSufficient: false,
  isLockupSufficient: false,
  isSufficient: false,
}

interface StorageBalanceCalculationInput {
  filBalance: bigint;
  usdfcBalance: bigint;
  availableFunds: bigint;
  priceList: PriceListResult;
  operatorApprovals: Payments.operatorApprovals.OutputType;
  storageCapacityBytes: number;
  persistencePeriodDays: number;
  notificationThresholdDays?: number;
  uploadCosts?: UploadCostsResult;
}

export const buildStorageBalanceResult = ({
  filBalance,
  usdfcBalance,
  availableFunds,
  priceList,
  operatorApprovals,
  storageCapacityBytes,
  persistencePeriodDays,
  notificationThresholdDays = env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS,
  uploadCosts,
}: StorageBalanceCalculationInput): StorageBalanceResult => {
  const storageCosts = calculateStorageCost(priceList, storageCapacityBytes)

  const currentMonthlyRate = operatorApprovals.rateUsage * TIME_CONSTANTS.EPOCHS_PER_MONTH;

  const maxMonthlyRate = storageCosts.perMonth

  const daysLeftAtMaxBurnRate = maxMonthlyRate === 0n ? Infinity : (Number(availableFunds) / Number(maxMonthlyRate)) * 30;
  const daysLeftAtBurnRate = currentMonthlyRate === 0n ? Infinity : (Number(availableFunds) / Number(currentMonthlyRate)) * 30;

  const fundingPeriodDays = Math.max(persistencePeriodDays, notificationThresholdDays);
  const amountNeeded = storageCosts.perDay * BigInt(Math.ceil(fundingPeriodDays));

  const recurringDepositNeeded =
    daysLeftAtMaxBurnRate >= notificationThresholdDays
      ? 0n
      : amountNeeded > availableFunds ? amountNeeded - availableFunds : 0n;

  const totalDepositNeeded = uploadCosts
    ? uploadCosts.depositNeeded > recurringDepositNeeded ? uploadCosts.depositNeeded : recurringDepositNeeded
    : recurringDepositNeeded;

  const availableToFreeUp =
    availableFunds > amountNeeded
      ? availableFunds - amountNeeded
      : 0n;

  const hasFwssMaxApproval = operatorApprovals.isApproved && operatorApprovals.rateAllowance === MAX_UINT256

  const isRateSufficient = uploadCosts
    ? !uploadCosts.needsFwssMaxApproval
    : hasFwssMaxApproval

  const isLockupSufficient = uploadCosts
    ? !uploadCosts.needsFwssMaxApproval
    : operatorApprovals.isApproved &&
      operatorApprovals.lockupAllowance >= MAX_UINT256 / 2n &&
      operatorApprovals.maxLockupPeriod >= priceList.lockups.defaultLockupPeriod;

  const isRecurringSufficient = daysLeftAtMaxBurnRate >= notificationThresholdDays;
  const isSufficient = uploadCosts
    ? uploadCosts.ready && isRecurringSufficient
    : isRateSufficient && isLockupSufficient && isRecurringSufficient;

  return {
    filBalance,
    usdfcBalance,
    availableStorageFundsUsdfc: availableFunds,
    depositNeeded: totalDepositNeeded,
    availableToFreeUp: availableToFreeUp,
    daysLeftAtMaxBurnRate: daysLeftAtMaxBurnRate,
    daysLeftAtBurnRate: daysLeftAtBurnRate,
    isRateSufficient,
    isLockupSufficient,
    isSufficient: isSufficient,
    currentStorageMonthlyRate: currentMonthlyRate,
    maxStorageMonthlyRate: maxMonthlyRate,
  };
};

const getCurrentDataSetSize = async (uploadOptions: StorageBalanceUploadOptions): Promise<bigint | undefined> => {
  if (uploadOptions.currentDataSetSize !== undefined || uploadOptions.isNewDataSet || uploadOptions.dataSetId === undefined) {
    return uploadOptions.currentDataSetSize;
  }

  const [currentDataSetSize] = await getDataSetSizes(publicClient, {
    dataSetIds: [uploadOptions.dataSetId],
  });
  return currentDataSetSize;
};

/**
 * Checks storage account balance and calculates deposit requirements
 * @param storageCapacityBytes Target storage capacity in bytes (default: 1TB)
 * @param persistencePeriodDays How long to maintain storage (default: 365 days)
 * @param uploadOptions Optional upload shape for v1 upload fee and lockup preflight
 * @returns Comprehensive balance information including FIL, USDFC, deposit needs, and sufficiency status
 */
export const checkStorageBalance = async (
  storageCapacityBytes: number = env.TOTAL_STORAGE_NEEDED_GiB * Number(SIZE_CONSTANTS.GiB),
  persistencePeriodDays: number = env.PERSISTENCE_PERIOD_DAYS,
  options: CheckStorageBalanceOptions = {},
): Promise<StorageBalanceResult> => {
  const uploadOptions = options.upload;
  const uploadCostsPromise = uploadOptions
    ? getCurrentDataSetSize(uploadOptions).then((currentDataSetSize) =>
      getUploadCosts(client, {
        clientAddress: account.address,
        dataSize: BigInt(storageCapacityBytes),
        isNewDataSet: uploadOptions.isNewDataSet,
        withCDN: uploadOptions.withCDN,
        currentDataSetSize,
        pieceCount: uploadOptions.pieceCount,
      })
    )
    : Promise.resolve(undefined);

  const [filRaw, { value: usdfcRaw }, { availableFunds }, priceList, operatorApprovals, uploadCosts] = await Promise.all([
    getBalance(client, {
      address: account.address,
    }),
    ERC20.balance(client, {
      address: account.address,
    }),
    Payments.accounts(client, {
      address: account.address,
    }),
    getWarmStoragePriceList(client),
    Payments.operatorApprovals(client, {
      address: account.address,
    }),
    uploadCostsPromise,
  ]);

  return buildStorageBalanceResult({
    filBalance: filRaw,
    usdfcBalance: usdfcRaw,
    availableFunds,
    priceList,
    operatorApprovals,
    storageCapacityBytes,
    persistencePeriodDays,
    notificationThresholdDays: options.notificationThresholdDays,
    uploadCosts,
  });
};

/**
 * Formats raw storage balance result into human-readable strings
 * @param checkStorageBalanceResult Raw balance data with bigint values
 * @returns Formatted balance result with human-readable strings
 */
export const formatStorageBalanceResult = (checkStorageBalanceResult: StorageBalanceResult): StorageBalanceResultFormatted => {
  return {
    filBalance: formatBalance(checkStorageBalanceResult.filBalance, "FIL"),
    usdfcBalance: formatBalance(checkStorageBalanceResult.usdfcBalance, "USDFC"),
    availableStorageFundsUsdfc: formatBalance(checkStorageBalanceResult.availableStorageFundsUsdfc, "USDFC"),
    depositNeeded: formatBalance(checkStorageBalanceResult.depositNeeded, "USDFC"),
    availableToFreeUp: formatBalance(checkStorageBalanceResult.availableToFreeUp, "USDFC"),
    currentStorageMonthlyRate: formatBalance(checkStorageBalanceResult.currentStorageMonthlyRate, "USDFC"),
    maxStorageMonthlyRate: formatBalance(checkStorageBalanceResult.maxStorageMonthlyRate, "USDFC"),
    daysLeftAtMaxBurnRate: formatTime(checkStorageBalanceResult.daysLeftAtMaxBurnRate),
    daysLeftAtBurnRate: formatTime(checkStorageBalanceResult.daysLeftAtBurnRate),
    isRateSufficient: checkStorageBalanceResult.isRateSufficient,
    isLockupSufficient: checkStorageBalanceResult.isLockupSufficient,
    isSufficient: checkStorageBalanceResult.isSufficient,
  };
};

const formatBalance = (balance: bigint, ticker: string) => {
  return `${Number(Number(formatUnits(balance, 18)).toFixed(8))} ${ticker}`;
};

const formatTime = (days: number) => {
  if (days === Infinity) {
    return "Infinity";
  }
  if (days < 1) {
    return `${Math.fround(days * 24)} hours`;
  }
  if (days < 30) {
    return `${Math.fround(days)} days`;
  }
  if (days < 365) {
    return `${Math.fround(days / 30)} months`;
  }
  return `${Math.fround(days / 365)} years`;
};

export interface StorageCostEstimate {
  monthlyCost: bigint;
  totalCost: bigint;
  totalCostFormatted: string;
  cdnSetupCost: bigint;
  cdnSetupCostFormatted: string;
  details: {
    sizeInBytes: number;
    sizeFormatted: string;
    durationInMonths: number;
    storagePerTiBPerMonth: bigint;
    datasetFeePerMonth: bigint;
    cdnEgressPerTiB: bigint;
    cacheMissEgressPerTiB: bigint;
    recurringMonthlyRate: bigint;
    createDataSetFee: bigint;
    addPiecesFee: bigint;
    oneTimeFees: bigint;
    lockupRequired: bigint;
    depositNeeded: bigint;
    needsFwssMaxApproval: boolean;
  };
}

export interface DatasetCreationFundingEstimate {
  depositNeeded: bigint;
  requiredFunding: bigint;
  createDataSetFee: bigint;
  lockupRequired: bigint;
  needsFwssMaxApproval: boolean;
}

export const estimateDatasetCreationFunding = async (
  withCDN: boolean,
): Promise<DatasetCreationFundingEstimate> => {
  const [accountInfo, priceList] = await Promise.all([
    Payments.accounts(client, {
      address: account.address,
    }),
    getWarmStoragePriceList(client),
  ]);

  const lockupRequired =
    priceList.lockups.lifecycleReserveTarget +
    (withCDN ? priceList.lockups.cdnLockupAmount + priceList.lockups.cacheMissLockupAmount : 0n);
  const requiredFunding = priceList.fees.createDataSetFee + lockupRequired;
  const depositNeeded = requiredFunding > accountInfo.availableFunds
    ? requiredFunding - accountInfo.availableFunds
    : 0n;
  const needsFwssMaxApproval = !(await Payments.isFwssMaxApproved(client, {
    clientAddress: account.address,
    requiredMaxLockupPeriod: priceList.lockups.defaultLockupPeriod,
  }));

  return {
    depositNeeded,
    requiredFunding,
    createDataSetFee: priceList.fees.createDataSetFee,
    lockupRequired,
    needsFwssMaxApproval,
  };
};

export const buildStorageCostEstimate = (
  sizeInBytes: number,
  durationInMonths: number,
  priceList: PriceListResult,
  uploadCosts: UploadCostsResult,
): StorageCostEstimate => {
  const pricePerMonth = uploadCosts.rates.perMonth;
  const oneTimeFees = uploadCosts.fees.total;
  const totalCost = pricePerMonth * BigInt(durationInMonths) + oneTimeFees;
  const cdnSetupCost = uploadCosts.lockups.cdnLockup + uploadCosts.lockups.cacheMissLockup;

  const sizeInGiB = Number(sizeInBytes) / Number(SIZE_CONSTANTS.GiB);
  const sizeInTiB = Number(sizeInBytes) / Number(SIZE_CONSTANTS.TiB);

  let sizeFormatted: string;
  if (sizeInTiB >= 1) {
    sizeFormatted = `${sizeInTiB.toFixed(2)} TiB`;
  } else if (sizeInGiB >= 1) {
    sizeFormatted = `${sizeInGiB.toFixed(2)} GiB`;
  } else {
    const sizeInMiB = Number(sizeInBytes) / Number(SIZE_CONSTANTS.MiB);
    sizeFormatted = `${sizeInMiB.toFixed(2)} MiB`;
  }

  return {
    monthlyCost: pricePerMonth,
    totalCost,
    totalCostFormatted: formatUnits(totalCost, 18),
    cdnSetupCost,
    cdnSetupCostFormatted: formatUnits(cdnSetupCost, 18),
    details: {
      sizeInBytes,
      sizeFormatted,
      durationInMonths,
      storagePerTiBPerMonth: priceList.rates.storagePerTibPerMonth,
      datasetFeePerMonth: priceList.rates.datasetFeePerMonth,
      cdnEgressPerTiB: priceList.rates.cdnEgressPerTib,
      cacheMissEgressPerTiB: priceList.rates.cacheMissEgressPerTib,
      recurringMonthlyRate: pricePerMonth,
      createDataSetFee: uploadCosts.fees.createDataSetFee,
      addPiecesFee: uploadCosts.fees.addPiecesFee,
      oneTimeFees,
      lockupRequired: uploadCosts.lockups.total,
      depositNeeded: uploadCosts.depositNeeded,
      needsFwssMaxApproval: uploadCosts.needsFwssMaxApproval,
    },
  };
};

/**
 * Estimate storage costs for a given size and duration
 * Based on the Synapse v1 price list:
 * - Storage: per-TiB monthly rate
 * - Dataset fee: flat recurring monthly service fee for non-empty datasets
 * - Upload fees: one-time create-dataset and add-pieces fees
 * - CDN/cache-miss: usage-based egress rates plus required lockups
 */
export const estimateStorageCost = async (
  sizeInBytes: number,
  durationInMonths: number,
  createCDNDataset: boolean = false
): Promise<StorageCostEstimate> => {
  const [priceList, uploadCosts] = await Promise.all([
    getWarmStoragePriceList(client),
    getUploadCosts(client, {
      clientAddress: account.address,
      isNewDataSet: true,
      withCDN: createCDNDataset,
      dataSize: BigInt(sizeInBytes),
    }),
  ]);
  return buildStorageCostEstimate(sizeInBytes, durationInMonths, priceList, uploadCosts);
};
