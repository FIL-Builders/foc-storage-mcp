import {
  SIZE_CONSTANTS,
  TIME_CONSTANTS,
} from "@filoz/synapse-core/utils";
import { formatUnits } from "viem";
import { MAX_UINT256, env } from "@/config";
import { ServicePriceResult } from "@filoz/synapse-core/warm-storage";
import * as ERC20 from "@filoz/synapse-core/erc20";
import * as Payments from "@filoz/synapse-core/pay";
import { getBalance } from "viem/actions";
import * as WarmStorage from "@filoz/synapse-core/warm-storage";
import { account, client } from "@/services/viem";

/**
 * Calculates storage costs per epoch, per day, and per month for a given size
 * @param prices Current service pricing from blockchain
 * @param sizeInBytes Storage size in bytes
 * @returns Object containing cost per epoch, per day, and per month in base units
 */
const calculateStorageCost = (prices: ServicePriceResult, sizeInBytes: number) => {
  const { pricePerTiBPerMonthNoCDN, epochsPerMonth } = prices
  // Calculate price per byte per epoch
  const sizeInBytesBigint = BigInt(sizeInBytes)
  const perEpoch =
    (pricePerTiBPerMonthNoCDN * sizeInBytesBigint) /
    (SIZE_CONSTANTS.TiB * epochsPerMonth)

  const perDay = perEpoch * TIME_CONSTANTS.EPOCHS_PER_DAY
  const perMonth = perEpoch * epochsPerMonth
  return {
    perEpoch,
    perDay,
    perMonth,
  }
}

interface StorageBalanceResult {
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

/**
 * Checks storage account balance and calculates deposit requirements
 * @param storageCapacityBytes Target storage capacity in bytes (default: 1TB)
 * @param persistencePeriodDays How long to maintain storage (default: 365 days)
 * @returns Comprehensive balance information including FIL, USDFC, deposit needs, and sufficiency status
 */
export const checkStorageBalance = async (
  storageCapacityBytes: number = env.TOTAL_STORAGE_NEEDED_GiB * Number(SIZE_CONSTANTS.GiB),
  persistencePeriodDays: number = env.PERSISTENCE_PERIOD_DAYS
): Promise<StorageBalanceResult> => {

  const [filRaw, { value: usdfcRaw }, { availableFunds }, prices, operatorApprovals] = await Promise.all([
    getBalance(client, {
      address: account.address,
    }),
    ERC20.balance(client, {
      address: account.address,
    }),
    Payments.accountInfo(client, {
      address: account.address,
    }),
    WarmStorage.servicePrice(client),
    Payments.operatorApprovals(client, {
      address: account.address,
    }),
  ]);

  const storageCosts = calculateStorageCost(prices, storageCapacityBytes)

  const currentMonthlyRate = operatorApprovals.rateUsed * TIME_CONSTANTS.EPOCHS_PER_MONTH;

  const maxMonthlyRate = storageCosts.perMonth

  const daysLeftAtMaxBurnRate = maxMonthlyRate === 0n ? Infinity : (Number(availableFunds) / Number(maxMonthlyRate)) * 30;
  const daysLeftAtBurnRate = currentMonthlyRate === 0n ? Infinity : (Number(availableFunds) / Number(currentMonthlyRate)) * 30;

  const amountNeeded = storageCosts.perDay * BigInt(persistencePeriodDays);

  const totalDepositNeeded =
    daysLeftAtMaxBurnRate >= env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS
      ? 0n
      : amountNeeded - availableFunds;

  const availableToFreeUp =
    availableFunds > amountNeeded
      ? availableFunds - amountNeeded
      : 0n;

  const isRateSufficient = operatorApprovals.rateAllowance === MAX_UINT256

  const isLockupSufficient = operatorApprovals.lockupAllowance === MAX_UINT256;

  const isSufficient = isRateSufficient && isLockupSufficient && daysLeftAtMaxBurnRate >= env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS;

  return {
    filBalance: filRaw,
    usdfcBalance: usdfcRaw,
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
    pricePerTiBPerMonth: bigint;
    minimumPricePerMonth: bigint;
    appliedMinimum: boolean;
  };
}

/**
 * Estimate storage costs for a given size and duration
 * Based on Filecoin OnchainCloud pricing model:
 * - Storage: $2.50/TiB/month
 * - Minimum: $0.06/month (~24.567 GiB threshold)
 * - CDN Setup: 1 USDFC (one-time for new datasets)
 * - CDN Egress: $7/TiB downloaded (pre-paid credits)
 */
export const estimateStorageCost = async (
  sizeInBytes: number,
  durationInMonths: number,
  createCDNDataset: boolean = false
): Promise<StorageCostEstimate> => {
  // Fetch current pricing from the service using synapse-core
  const prices = await WarmStorage.servicePrice(client);

  const { minimumPricePerMonth, pricePerTiBPerMonthNoCDN } = prices;

  // Calculate monthly cost
  let pricePerMonth =
    (pricePerTiBPerMonthNoCDN * BigInt(sizeInBytes)) /
    BigInt(SIZE_CONSTANTS.TiB);

  const appliedMinimum = pricePerMonth < minimumPricePerMonth;

  if (appliedMinimum) {
    pricePerMonth = minimumPricePerMonth;
  }

  // Calculate total cost for the duration
  let totalCost = pricePerMonth * BigInt(durationInMonths);

  // Add CDN setup cost if needed (1 USDFC)
  const cdnSetupCost = createCDNDataset ? 10n ** 18n : 0n;
  totalCost += cdnSetupCost;

  // Format size for display
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
      pricePerTiBPerMonth: pricePerTiBPerMonthNoCDN,
      minimumPricePerMonth,
      appliedMinimum,
    },
  };
};
