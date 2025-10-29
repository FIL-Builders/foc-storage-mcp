import {
  SIZE_CONSTANTS,
  Synapse,
  TIME_CONSTANTS,
  TOKENS,
  WarmStorageService,
} from "@filoz/synapse-sdk";
import { formatUnits } from "viem";
import { MAX_UINT256, env } from "@/config";

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

export const checkStorageBalance = async (
  synapse: Synapse,
  storageCapacityBytes: number = env.TOTAL_STORAGE_NEEDED_GiB * Number(SIZE_CONSTANTS.GiB),
  persistencePeriodDays: number = env.PERSISTENCE_PERIOD_DAYS
): Promise<StorageBalanceResult> => {

  const warmStorageService = await WarmStorageService.create(synapse.getProvider(), synapse.getWarmStorageAddress());

  // Fetch approval info, storage costs, and balance in parallel
  const [storageInfo, accountInfo, prices] = await Promise.all([
    synapse.storage.getStorageInfo(),
    synapse.payments.accountInfo(TOKENS.USDFC),
    warmStorageService.calculateStorageCost(storageCapacityBytes)
  ]);

  let filRaw: bigint;

  try {
    filRaw = await synapse.payments.walletBalance();
  } catch (error) {
    console.error(error);
    throw new Error("Error fetching wallet balances. \n FIL balance not available. \n The main cause of this error is that your wallet doesn't have any FIL and has no transaction history on the network. Action: Top up your wallet with FIL.");
  }

  let usdfcRaw = await synapse.payments.walletBalance(TOKENS.USDFC);

  const allowance = storageInfo.allowances!;

  const availableFunds = accountInfo.availableFunds;

  const currentMonthlyRate = allowance.rateUsed * TIME_CONSTANTS.EPOCHS_PER_MONTH;

  const maxMonthlyRate = prices.perMonth

  const daysLeftAtMaxBurnRate = maxMonthlyRate === 0n ? Infinity : (Number(availableFunds) / Number(maxMonthlyRate)) * 30;
  const daysLeftAtBurnRate = currentMonthlyRate === 0n ? Infinity : (Number(availableFunds) / Number(currentMonthlyRate)) * 30;

  const amountNeeded = prices.perDay * BigInt(persistencePeriodDays);

  const totalDepositNeeded =
    daysLeftAtMaxBurnRate >= env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS
      ? 0n
      : amountNeeded - accountInfo.availableFunds;

  const availableToFreeUp =
    accountInfo.availableFunds > amountNeeded
      ? accountInfo.availableFunds - amountNeeded
      : 0n;

  const isRateSufficient = allowance.rateAllowance === MAX_UINT256

  const isLockupSufficient = allowance.lockupAllowance === MAX_UINT256;

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
