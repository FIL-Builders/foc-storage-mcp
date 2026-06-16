import assert from "node:assert/strict";
import test from "node:test";

process.env.PRIVATE_KEY = `0x${"1".repeat(64)}`;
process.env.FILECOIN_NETWORK = "calibration";

const USDFC = 10n ** 18n;
const ADDRESS = "0x0000000000000000000000000000000000000001";
const MAX_UINT256 = 2n ** 256n - 1n;

test("buildStorageCostEstimate preserves Synapse v1 recurring fees, upload fees, and lockups", async () => {
  const { buildStorageCostEstimate } = await import("../src/services/storage-service");

  const priceList = {
    token: ADDRESS,
    rates: {
      storagePerTibPerMonth: 2_500_000_000_000_000_000n,
      datasetFeePerMonth: 24_000_000_000_000_000n,
      cdnEgressPerTib: 14n * USDFC,
      cacheMissEgressPerTib: 20n * USDFC,
    },
    fees: {
      createDataSetFee: 100_000_000_000_000_000n,
      addPiecesBaseFee: 10_000_000_000_000_000n,
      addPiecesPerPieceFee: 1_000_000_000_000_000n,
      schedulePieceRemovalsFee: 2_000_000_000_000_000n,
      terminateFee: 3_000_000_000_000_000n,
    },
    lockups: {
      lifecycleReserveTarget: 500_000_000_000_000_000n,
      replenishThreshold: 100_000_000_000_000_000n,
      defaultLockupPeriod: 2_592_000n,
      cdnLockupAmount: 600_000_000_000_000_000n,
      cacheMissLockupAmount: 400_000_000_000_000_000n,
      cdnLockupPeriod: 2_592_000n,
    },
  };

  const uploadCosts = {
    rates: {
      perEpoch: 29_212_962_962_962n,
      perMonth: 2_524_000_000_000_000_000n,
    },
    fees: {
      createDataSetFee: priceList.fees.createDataSetFee,
      addPiecesFee: 11_000_000_000_000_000n,
      total: 111_000_000_000_000_000n,
    },
    lockups: {
      lifecycleLockup: priceList.lockups.lifecycleReserveTarget,
      streamingLockup: 75_720_000_000_000_000_000n,
      cdnLockup: priceList.lockups.cdnLockupAmount,
      cacheMissLockup: priceList.lockups.cacheMissLockupAmount,
      total: 76_720_000_000_000_000_000n,
    },
    depositNeeded: 76_831_000_000_000_000_000n,
    needsFwssMaxApproval: true,
    ready: false,
  };

  const estimate = buildStorageCostEstimate(
    Number(1n << 40n),
    12,
    priceList as any,
    uploadCosts as any,
  );

  assert.equal(estimate.monthlyCost, uploadCosts.rates.perMonth);
  assert.equal(estimate.totalCost, uploadCosts.rates.perMonth * 12n + uploadCosts.fees.total);
  assert.equal(estimate.cdnSetupCost, uploadCosts.lockups.cdnLockup + uploadCosts.lockups.cacheMissLockup);
  assert.equal(estimate.details.storagePerTiBPerMonth, priceList.rates.storagePerTibPerMonth);
  assert.equal(estimate.details.datasetFeePerMonth, priceList.rates.datasetFeePerMonth);
  assert.equal(estimate.details.oneTimeFees, uploadCosts.fees.total);
  assert.equal(estimate.details.depositNeeded, uploadCosts.depositNeeded);
  assert.equal(estimate.details.needsFwssMaxApproval, true);
});

test("buildStorageBalanceResult includes Synapse v1 upload deposit and approval readiness", async () => {
  const { buildStorageBalanceResult } = await import("../src/services/storage-service");

  const priceList = {
    token: ADDRESS,
    rates: {
      storagePerTibPerMonth: 2_500_000_000_000_000_000n,
      datasetFeePerMonth: 24_000_000_000_000_000n,
      cdnEgressPerTib: 14n * USDFC,
      cacheMissEgressPerTib: 20n * USDFC,
    },
    fees: {
      createDataSetFee: 100_000_000_000_000_000n,
      addPiecesBaseFee: 10_000_000_000_000_000n,
      addPiecesPerPieceFee: 1_000_000_000_000_000n,
      schedulePieceRemovalsFee: 2_000_000_000_000_000n,
      terminateFee: 3_000_000_000_000_000n,
    },
    lockups: {
      lifecycleReserveTarget: 500_000_000_000_000_000n,
      replenishThreshold: 100_000_000_000_000_000n,
      defaultLockupPeriod: 2_592_000n,
      cdnLockupAmount: 600_000_000_000_000_000n,
      cacheMissLockupAmount: 400_000_000_000_000_000n,
      cdnLockupPeriod: 2_592_000n,
    },
  };
  const operatorApprovals = {
    isApproved: true,
    rateAllowance: MAX_UINT256,
    lockupAllowance: MAX_UINT256,
    rateUsage: 0n,
    lockupUsage: 0n,
    maxLockupPeriod: priceList.lockups.defaultLockupPeriod,
  };
  const baseInput = {
    filBalance: 1n,
    usdfcBalance: 10n * USDFC,
    availableFunds: 10n * USDFC,
    priceList: priceList as any,
    operatorApprovals,
    storageCapacityBytes: Number(1n << 40n),
    persistencePeriodDays: 365,
  };
  const uploadCosts = {
    rates: {
      perEpoch: 29_212_962_962_962n,
      perMonth: 2_524_000_000_000_000_000n,
    },
    fees: {
      createDataSetFee: priceList.fees.createDataSetFee,
      addPiecesFee: 11_000_000_000_000_000n,
      total: 111_000_000_000_000_000n,
    },
    lockups: {
      lifecycleLockup: priceList.lockups.lifecycleReserveTarget,
      streamingLockup: 75_720_000_000_000_000_000n,
      cdnLockup: 0n,
      cacheMissLockup: 0n,
      total: 76_220_000_000_000_000_000n,
    },
    depositNeeded: 66_331_000_000_000_000_000n,
    needsFwssMaxApproval: true,
    ready: false,
  };

  const recurringOnly = buildStorageBalanceResult(baseInput);
  assert.equal(recurringOnly.depositNeeded, 0n);
  assert.equal(recurringOnly.isSufficient, true);

  const strictThreshold = buildStorageBalanceResult({
    ...baseInput,
    notificationThresholdDays: 120,
  });
  assert.ok(strictThreshold.depositNeeded > 0n);
  assert.equal(strictThreshold.isSufficient, false);

  const uploadPreflight = buildStorageBalanceResult({
    ...baseInput,
    uploadCosts,
  });

  assert.equal(uploadPreflight.depositNeeded, uploadCosts.depositNeeded);
  assert.equal(uploadPreflight.isRateSufficient, false);
  assert.equal(uploadPreflight.isLockupSufficient, false);
  assert.equal(uploadPreflight.isSufficient, false);
});

test("toMcpDataset returns JSON-safe dataset and piece CID values", async () => {
  const { toMcpDataset } = await import("../src/services/dataset-service");

  const dataset = {
    pdpRailId: 1n,
    cacheMissRailId: 2n,
    cdnRailId: 3n,
    payer: ADDRESS,
    payee: ADDRESS,
    serviceProvider: ADDRESS,
    commissionBps: 100n,
    clientDataSetId: 42n,
    pdpEndEpoch: 999n,
    providerId: 7n,
    dataSetId: 12n,
    live: true,
    managed: true,
    cdn: false,
    metadata: {
      owner: "tester",
      nested: {
        count: 5n,
      },
    },
    provider: {
      id: 7n,
      payee: ADDRESS,
      serviceProvider: ADDRESS,
      pdp: {
        serviceURL: "https://provider.example",
      },
    },
    activePieceCount: 1n,
  };

  const mcpDataset = toMcpDataset(dataset as any, [
    {
      id: "9",
      url: "https://provider.example/piece/bafkz...",
      metadata: {
        filename: "sample.txt",
      },
      cid: "bafkzcibsample",
    },
  ]);

  assert.equal(mcpDataset.dataSetId, "12");
  assert.equal(mcpDataset.providerId, "7");
  const metadata = mcpDataset.metadata as { nested: { count: string } };
  assert.equal(metadata.nested.count, "5");
  assert.equal(mcpDataset.pieces[0].id, "9");
  assert.equal(mcpDataset.pieces[0].cid, "bafkzcibsample");
  assert.doesNotThrow(() => JSON.stringify(mcpDataset));
});

test("tool schemas reject fractional numeric inputs and non-integer IDs", async () => {
  const {
    CreateDatasetSchema,
    GetBalancesSchema,
    ProcessWithdrawalSchema,
    UploadFileSchema,
  } = await import("../src/types/schemas");

  assert.equal(GetBalancesSchema.safeParse({ storageCapacityBytes: 1.5 }).success, false);
  assert.equal(GetBalancesSchema.safeParse({ persistencePeriodDays: 30.5 }).success, false);
  assert.equal(GetBalancesSchema.safeParse({ notificationThresholdDays: 0 }).success, false);
  assert.equal(UploadFileSchema.safeParse({ filePath: "/tmp/file.txt", datasetId: "12.5" }).success, false);
  assert.equal(CreateDatasetSchema.safeParse({ providerId: "provider-1" }).success, false);
  assert.equal(ProcessWithdrawalSchema.safeParse({ withdrawalAmount: 0 }).success, false);
  assert.equal(ProcessWithdrawalSchema.safeParse({ withdrawalAmount: -1 }).success, false);

  assert.equal(GetBalancesSchema.safeParse({
    storageCapacityBytes: 1024,
    persistencePeriodDays: 365,
    notificationThresholdDays: 45,
  }).success, true);
  assert.equal(ProcessWithdrawalSchema.safeParse({}).success, true);
  assert.equal(ProcessWithdrawalSchema.safeParse({ withdrawalAmount: 1 }).success, true);
});

test("processWithdrawal requires an explicit amount before any transaction path", async () => {
  const { processWithdrawal } = await import("../src/mastra/tools/payment-tools");

  const result = await processWithdrawal.execute({
    context: {},
    runtimeContext: new Map(),
  } as never);

  assert.equal(result.success, false);
  assert.equal(result.txHash, null);
  assert.equal(result.error, "withdrawal_amount_required");
  assert.match(result.message, /Provide withdrawalAmount explicitly/);
  assert.ok(result.progressLog?.some((entry) => entry.includes("refusing to auto-withdraw")));
});

test("toBaseUnits handles decimal and scientific notation without rounding", async () => {
  const { toBaseUnits } = await import("../src/lib");

  assert.equal(toBaseUnits("1", 18), 1_000_000_000_000_000_000n);
  assert.equal(toBaseUnits("1e-18", 18), 1n);
  assert.equal(toBaseUnits(1e-18, 18), 1n);
  assert.equal(toBaseUnits("123456789012345678.123456789012345678", 18), 123456789012345678123456789012345678n);
  assert.throws(() => toBaseUnits("0.0000000000000000001", 18), /more than 18 decimal places/);
  assert.throws(() => toBaseUnits("-1", 18), /non-negative finite/);
});
