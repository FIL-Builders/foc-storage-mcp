import { createTool } from "@mastra/core";
import { z } from "zod";
import { estimateStorageCost } from "@/services/storage-service";
import { SIZE_CONSTANTS } from "@filoz/synapse-core/utils";

/**
 * Schema for storage cost estimation input
 * Users can specify size in either GiB or TiB (exactly one must be provided)
 */
const EstimateStorageCostSchema = z.object({
  sizeInGiB: z.number()
    .positive()
    .optional()
    .describe('Size of data to store in GiB (gibibytes). Example: 1.5 for 1.5 GiB. Provide either sizeInGiB or sizeInTiB, not both'),
  sizeInTiB: z.number()
    .positive()
    .optional()
    .describe('Size of data to store in TiB (tebibytes). Example: 0.5 for 0.5 TiB. Provide either sizeInGiB or sizeInTiB, not both'),
  durationInMonths: z.number()
    .positive()
    .int()
    .describe('Duration to store data in months. Example: 12 for one year'),
  createCDNDataset: z.boolean()
    .optional()
    .default(false)
    .describe('Whether this is for a new CDN-enabled dataset. Default: false'),
}).refine(
  (data) => (data.sizeInGiB !== undefined) !== (data.sizeInTiB !== undefined),
  {
    message: "Exactly one of sizeInGiB or sizeInTiB must be provided",
  }
);

/**
 * Schema for storage cost estimation output
 */
const EstimateStorageCostOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  monthlyCost: z.string().optional()
    .describe('Monthly storage cost in USDFC'),
  totalCost: z.string().optional()
    .describe('Total storage cost for duration in USDFC (includes CDN setup if applicable)'),
  cdnSetupCost: z.string().optional()
    .describe('Legacy field: v1 CDN/cache-miss lockup required in USDFC when createCDNDataset is true'),
  cdnEgressCredits: z.string().optional()
    .describe('Approximate CDN egress capacity per 1 USDFC prepaid balance'),
  details: z.object({
    sizeInBytes: z.number(),
    sizeFormatted: z.string().describe('Human-readable size (e.g., "1.50 GiB")'),
    durationInMonths: z.number(),
    storagePerTiBPerMonth: z.string(),
    datasetFeePerMonth: z.string(),
    cdnEgressPerTiB: z.string(),
    cacheMissEgressPerTiB: z.string(),
    recurringMonthlyRate: z.string(),
    createDataSetFee: z.string(),
    addPiecesFee: z.string(),
    oneTimeFees: z.string(),
    lockupRequired: z.string(),
    depositNeeded: z.string(),
    needsFwssMaxApproval: z.boolean(),
  }).optional(),
  breakdown: z.string().optional()
    .describe('Human-readable cost breakdown'),
  pricingExplanation: z.string().optional()
    .describe('Detailed explanation of how storage pricing works'),
  cdnPricingExplanation: z.string().optional()
    .describe('Detailed explanation of how CDN egress pricing works'),
  // Error fields
  error: z.string().optional(),
  message: z.string(),
});

/**
 * Storage cost calculator tool for FOC storage operations.
 *
 * Calculates storage costs based on Synapse v1 Filecoin OnchainCloud pricing:
 * - Storage: live per-TiB monthly rate
 * - Dataset fee: a flat recurring per-dataset service fee from the v1 price list
 * - Upload fees: one-time create-dataset and add-pieces fees from the v1 price list
 * - Epochs: 30 seconds each
 */
const estimateStoragePricing = createTool({
  id: "estimateStoragePricing",
  description:
    "Calculate storage costs for Filecoin OnchainCloud and explain Synapse v1 pricing. Provides: (1) recurring monthly/total breakdowns, (2) one-time create-dataset/add-pieces fees, (3) lockup and deposit readiness, and (4) CDN egress pricing from the live price list. ⚠️ CRITICAL: When explaining budgeting, ALWAYS warn that storage providers consider accounts with less than 30 days of remaining balance as INSOLVENT and may refuse service. Recommend maintaining at least 45 days of balance for safety margin. Use when users ask about storage costs, pricing models, CDN fees, or need to budget for storage.",
  inputSchema: EstimateStorageCostSchema,
  outputSchema: EstimateStorageCostOutputSchema,
  execute: async ({ context }) => {
    try {
      const { sizeInGiB, sizeInTiB, durationInMonths, createCDNDataset } = context;

      // Convert size to bytes
      let sizeInBytes: number;
      if (sizeInGiB !== undefined) {
        sizeInBytes = sizeInGiB * Number(SIZE_CONSTANTS.GiB);
      } else if (sizeInTiB !== undefined) {
        sizeInBytes = sizeInTiB * Number(SIZE_CONSTANTS.TiB);
      } else {
        throw new Error("Either sizeInGiB or sizeInTiB must be provided");
      }

      // Estimate the storage cost
      const estimate = await estimateStorageCost(
        sizeInBytes,
        durationInMonths,
        createCDNDataset
      );

      const cdnEgressRatePerTiB = Number(estimate.details.cdnEgressPerTiB) / 1e18;
      const cdnEgressCreditsGiB = createCDNDataset && cdnEgressRatePerTiB > 0
        ? (1 / cdnEgressRatePerTiB) * 1024
        : 0;

      // Create a human-readable breakdown
      const breakdown = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Storage Cost Estimate for ${estimate.details.sizeFormatted}`,
        `Duration: ${durationInMonths} month${durationInMonths !== 1 ? 's' : ''}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Monthly Storage Cost: ${Number(estimate.monthlyCost) / 1e18} USDFC`,
        `Recurring Storage Cost: ${Number(estimate.monthlyCost * BigInt(durationInMonths)) / 1e18} USDFC`,
        `One-time Upload Fees: ${Number(estimate.details.oneTimeFees) / 1e18} USDFC`,
      ];

      if (createCDNDataset) {
        breakdown.push(``);
        breakdown.push(`CDN/Cache-miss Lockup Required: ${estimate.cdnSetupCostFormatted} USDFC`);
        breakdown.push(`  → CDN egress is usage-based at ${cdnEgressRatePerTiB} USDFC/TiB`);
        breakdown.push(`  → 1 USDFC of prepaid balance covers ~${cdnEgressCreditsGiB.toFixed(2)} GiB of CDN egress`);
        breakdown.push(``);
        breakdown.push(`Grand Total (Recurring Storage + Upload Fees): ${estimate.totalCostFormatted} USDFC`);
      }

      breakdown.push(``);
      breakdown.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      breakdown.push(`Note: Synapse v1 pricing includes a flat per-dataset monthly service fee for non-empty datasets.`);

      // Pricing explanation
      const pricingExplanation = [
        ``,
        `HOW STORAGE PRICING WORKS:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Storage operates on a pay-per-epoch model (epochs are 30 seconds):`,
        ``,
        `1. BASE RATE: Storage per TiB per month from the live Synapse v1 price list`,
        `   - Calculated per epoch: (size / TiB) × storage rate ÷ epochs_per_month`,
        `   - Recurring display cost also includes the v1 per-dataset monthly service fee`,
        ``,
        `2. ONE-TIME UPLOAD FEES:`,
        `   - New datasets pay the create-dataset fee`,
        `   - Uploads pay add-pieces base/per-piece fees`,
        `   - CDN datasets may require CDN/cache-miss lockup in addition to recurring storage`,
        ``,
        `3. PAYMENT MODEL:`,
        `   - Deposit USDFC tokens into your account`,
        `   - Set rate allowance (max spending per epoch)`,
        `   - Set lockup allowance (max total locked funds)`,
        `   - Storage service deducts costs automatically each epoch`,
        ``,
        `4. EPOCHS:`,
        `   - 1 epoch = 30 seconds`,
        `   - ~2,880 epochs per day`,
        `   - ~86,400 epochs per month (30 days)`,
        ``,
        `⚠️ CRITICAL - INSOLVENCY WARNING:`,
        `   - Storage providers consider accounts with LESS THAN 30 DAYS of`,
        `     remaining balance as INSOLVENT`,
        `   - Insolvent accounts may be REFUSED SERVICE or have data removed`,
        `   - ALWAYS maintain at least 45 days of balance for safety margin`,
        `   - Default notification threshold: 45 days (gives time to deposit)`,
        `   - Monitor your balance regularly and top up before hitting 30 days`,
        ``,
      ].join('\n');

      // CDN pricing explanation
      const cdnPricingExplanation = [
        ``,
        `HOW CDN EGRESS PRICING WORKS:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `CDN enables fast file retrieval with egress (download) charges:`,
        ``,
        `1. EGRESS RATE: ${cdnEgressRatePerTiB} USDFC per TiB downloaded`,
        `   - Live rate from the Synapse v1 price list`,
        `   - Only pay for actual data transferred`,
        ``,
        `2. CDN CREDITS TOP-UP (Not a Fee!):`,
        `   - CDN egress uses prepaid account balance`,
        `   - 1 USDFC currently covers ~${cdnEgressCreditsGiB.toFixed(2)} GiB at the live price-list rate`,
        `   - Credits are deducted as files are downloaded`,
        ``,
        `3. REUSING DATASETS:`,
        `   - Adding files to existing CDN datasets still uses usage-based egress billing`,
        `   - Existing datasets avoid new create-dataset fees`,
        `   - Your prepaid account balance can fund egress across datasets`,
        ``,
        `4. TOPPING UP CREDITS:`,
        `   - Top up anytime to avoid running out`,
        `   - Monitor your remaining egress credits`,
        `   - No expiration on credits`,
        ``,
        `5. EXAMPLE CALCULATIONS:`,
        `   - 1 USDFC → ~${cdnEgressCreditsGiB.toFixed(2)} GiB of downloads`,
        `   - ${cdnEgressRatePerTiB} USDFC → ~1 TiB of downloads`,
        ``,
        `6. WHEN TO USE CDN:`,
        `   - Frequently accessed files`,
        `   - Public-facing content`,
        `   - Applications requiring fast retrieval`,
        `   - Skip CDN for archival/backup storage`,
        ``,
      ].join('\n');

      return {
        success: true,
        monthlyCost: (Number(estimate.monthlyCost) / 1e18).toString(),
        totalCost: estimate.totalCostFormatted,
        cdnSetupCost: estimate.cdnSetupCostFormatted,
        cdnEgressCredits: createCDNDataset ? `${cdnEgressCreditsGiB.toFixed(2)} GiB (~${(cdnEgressCreditsGiB / 1024).toFixed(4)} TiB) per 1 USDFC prepaid balance` : '0 GiB',
        details: {
          ...estimate.details,
          storagePerTiBPerMonth: estimate.details.storagePerTiBPerMonth.toString(),
          datasetFeePerMonth: estimate.details.datasetFeePerMonth.toString(),
          cdnEgressPerTiB: estimate.details.cdnEgressPerTiB.toString(),
          cacheMissEgressPerTiB: estimate.details.cacheMissEgressPerTiB.toString(),
          recurringMonthlyRate: estimate.details.recurringMonthlyRate.toString(),
          createDataSetFee: estimate.details.createDataSetFee.toString(),
          addPiecesFee: estimate.details.addPiecesFee.toString(),
          oneTimeFees: estimate.details.oneTimeFees.toString(),
          lockupRequired: estimate.details.lockupRequired.toString(),
          depositNeeded: estimate.details.depositNeeded.toString(),
        },
        breakdown: breakdown.join('\n'),
        pricingExplanation,
        cdnPricingExplanation,
        message: `Estimated cost: ${estimate.totalCostFormatted} USDFC for ${estimate.details.sizeFormatted} over ${durationInMonths} month${durationInMonths !== 1 ? 's' : ''}${createCDNDataset ? ' (CDN egress billed separately from prepaid balance; 1 USDFC covers ~' + cdnEgressCreditsGiB.toFixed(2) + ' GiB at current rates)' : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        message: `Failed to estimate storage cost: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Helper tool to provide common storage size conversions
 */
const convertStorageSize = createTool({
  id: "convertStorageSize",
  description:
    "Convert storage sizes between different units (bytes, KiB, MiB, GiB, TiB). Useful when users provide sizes in different formats and you need to calculate storage costs.",
  inputSchema: z.object({
    value: z.number().positive()
      .describe('The numeric value to convert'),
    fromUnit: z.enum(['bytes', 'KiB', 'MiB', 'GiB', 'TiB'])
      .describe('The unit to convert from'),
    toUnit: z.enum(['bytes', 'KiB', 'MiB', 'GiB', 'TiB'])
      .optional()
      .describe('The unit to convert to. If not specified, returns all units'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    bytes: z.number().optional(),
    KiB: z.number().optional(),
    MiB: z.number().optional(),
    GiB: z.number().optional(),
    TiB: z.number().optional(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const { value, fromUnit, toUnit } = context;

      // Convert to bytes first
      let bytes: number;
      switch (fromUnit) {
        case 'bytes':
          bytes = value;
          break;
        case 'KiB':
          bytes = value * Number(SIZE_CONSTANTS.KiB);
          break;
        case 'MiB':
          bytes = value * Number(SIZE_CONSTANTS.MiB);
          break;
        case 'GiB':
          bytes = value * Number(SIZE_CONSTANTS.GiB);
          break;
        case 'TiB':
          bytes = value * Number(SIZE_CONSTANTS.TiB);
          break;
      }

      // If specific toUnit requested, return only that
      if (toUnit) {
        let result: number;
        switch (toUnit) {
          case 'bytes':
            result = bytes;
            break;
          case 'KiB':
            result = bytes / Number(SIZE_CONSTANTS.KiB);
            break;
          case 'MiB':
            result = bytes / Number(SIZE_CONSTANTS.MiB);
            break;
          case 'GiB':
            result = bytes / Number(SIZE_CONSTANTS.GiB);
            break;
          case 'TiB':
            result = bytes / Number(SIZE_CONSTANTS.TiB);
            break;
        }

        return {
          success: true,
          [toUnit]: result,
          message: `${value} ${fromUnit} = ${result.toFixed(4)} ${toUnit}`,
        };
      }

      // Return all conversions
      return {
        success: true,
        bytes,
        KiB: bytes / Number(SIZE_CONSTANTS.KiB),
        MiB: bytes / Number(SIZE_CONSTANTS.MiB),
        GiB: bytes / Number(SIZE_CONSTANTS.GiB),
        TiB: bytes / Number(SIZE_CONSTANTS.TiB),
        message: `Converted ${value} ${fromUnit} to all units`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        message: `Failed to convert storage size: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Tool that provides detailed information about storage pricing
 * Includes comprehensive pricing model explanation with a 1TiB/1year example
 */
const getStoragePricingInfo = createTool({
  id: "getStoragePricingInfo",
  description:
    "Get comprehensive information about Filecoin OnchainCloud storage pricing, including cost structure, CDN egress pricing, payment model, and a detailed example of storing 1 TiB for 1 year. ⚠️ CRITICAL: ALWAYS include the insolvency warning (accounts with less than 30 days balance are considered insolvent and may be refused service). Recommend 45-day minimum balance. Use this when users ask general questions about 'how much does storage cost', 'explain storage pricing', 'how does billing work', or want to understand the pricing model before calculating specific costs.",
  inputSchema: z.object({
    includeCDNExample: z.boolean()
      .optional()
      .default(true)
      .describe('Include CDN pricing example. Default: true'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    pricingOverview: z.string().optional(),
    storageModel: z.object({
      baseRate: z.string(),
      datasetFee: z.string(),
      uploadFees: z.string(),
      epochDuration: z.string(),
      epochsPerDay: z.number(),
      epochsPerMonth: z.number(),
    }).optional(),
    cdnModel: z.object({
      egressRate: z.string(),
      lockupRequired: z.string(),
      creditsPerUSDFC: z.string(),
      isUsageBased: z.boolean(),
      canTopUpMore: z.boolean(),
    }).optional(),
    exampleCalculation: z.object({
      scenario: z.string(),
      size: z.string(),
      duration: z.string(),
      monthlyCost: z.string(),
      yearlyStorageCost: z.string(),
      cdnTopUp: z.string().optional(),
      cdnEgressCredits: z.string().optional(),
      totalCost: z.string(),
      breakdown: z.string(),
    }).optional(),
    paymentModel: z.string().optional(),
    error: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      const { includeCDNExample } = context;

      // Calculate 1 TiB for 1 year as the example
      const exampleSizeBytes = Number(SIZE_CONSTANTS.TiB);
      const exampleDurationMonths = 12;

      const estimate = await estimateStorageCost(
        exampleSizeBytes,
        exampleDurationMonths,
        includeCDNExample
      );

      const cdnEgressRatePerTiB = Number(estimate.details.cdnEgressPerTiB) / 1e18;
      const cdnEgressCreditsGiB = includeCDNExample && cdnEgressRatePerTiB > 0
        ? (1 / cdnEgressRatePerTiB) * 1024
        : 0;
      const recurringStorageCost = estimate.monthlyCost * BigInt(exampleDurationMonths);

      const pricingOverview = [
        `FILECOIN ONCHAINCLOUD STORAGE PRICING`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Filecoin OnchainCloud provides decentralized storage with transparent,`,
        `usage-based pricing. You only pay for what you store, when you store it.`,
        ``,
        `COST COMPONENTS:`,
        `  • Storage: Pay per epoch (30-second intervals) for stored data`,
        `  • CDN Egress: Pay per TiB downloaded (optional, for fast retrieval)`,
        `  • Upload fees and lockups are shown separately from recurring storage`,
        ``,
      ].join('\n');

      const storageModel = {
        baseRate: `${Number(estimate.details.storagePerTiBPerMonth) / 1e18} USDFC per TiB per month`,
        datasetFee: `${Number(estimate.details.datasetFeePerMonth) / 1e18} USDFC per non-empty dataset per month`,
        uploadFees: `${Number(estimate.details.oneTimeFees) / 1e18} USDFC for the example create-dataset/add-pieces operation`,
        epochDuration: "30 seconds",
        epochsPerDay: 2880,
        epochsPerMonth: 86400, // 30 days
      };

      const cdnModel = includeCDNExample ? {
        egressRate: `${cdnEgressRatePerTiB} USDFC per TiB downloaded`,
        lockupRequired: `${estimate.cdnSetupCostFormatted} USDFC CDN/cache-miss lockup for the example`,
        creditsPerUSDFC: `~${cdnEgressCreditsGiB.toFixed(2)} GiB of egress per 1 USDFC prepaid balance`,
        isUsageBased: true,
        canTopUpMore: true,
      } : undefined;

      const exampleBreakdown = [
        `DETAILED CALCULATION:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Size: 1 TiB (1,099,511,627,776 bytes)`,
        `Duration: 12 months (1 year)`,
        ``,
        `STORAGE COSTS:`,
        `  Base Rate: ${Number(estimate.details.storagePerTiBPerMonth) / 1e18} USDFC/TiB/month`,
        `  Dataset Fee: ${Number(estimate.details.datasetFeePerMonth) / 1e18} USDFC/month`,
        `  Calculation: recurring monthly rate × 12 months`,
        `  Monthly Cost: ${(Number(estimate.monthlyCost) / 1e18).toFixed(4)} USDFC`,
        `  Yearly Recurring Storage: ${(Number(recurringStorageCost) / 1e18).toFixed(4)} USDFC`,
        `  One-time Upload Fees: ${(Number(estimate.details.oneTimeFees) / 1e18).toFixed(4)} USDFC`,
        ``,
      ];

      if (includeCDNExample) {
        exampleBreakdown.push(
          `CDN EGRESS (Optional):`,
          `  Egress Rate: ${cdnEgressRatePerTiB} USDFC/TiB`,
          `  1 USDFC prepaid balance provides: ~${cdnEgressCreditsGiB.toFixed(2)} GiB of downloads`,
          `  CDN/cache-miss lockup required: ${estimate.cdnSetupCostFormatted} USDFC`,
          `  Additional prepaid balance can be added anytime`,
          ``,
        );
      }

      exampleBreakdown.push(
        `TOTAL COST:`,
        `  Recurring storage (12 months): ${(Number(recurringStorageCost) / 1e18).toFixed(4)} USDFC`,
        `  One-time upload fees: ${(Number(estimate.details.oneTimeFees) / 1e18).toFixed(4)} USDFC`,
      );

      if (includeCDNExample) {
        exampleBreakdown.push(
          `  CDN/cache-miss lockup: ${estimate.cdnSetupCostFormatted} USDFC`,
          `  ────────────────────`,
          `  Grand Total excluding refundable lockup: ${estimate.totalCostFormatted} USDFC`,
          ``,
          `Note: CDN egress is charged from prepaid balance as data is downloaded.`,
        );
      } else {
        exampleBreakdown.push(
          `  ────────────────────`,
          `  Total: ${estimate.totalCostFormatted} USDFC`,
        );
      }

      const paymentModel = [
        ``,
        `HOW PAYMENT WORKS:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `1. DEPOSIT FUNDS:`,
        `   • Add USDFC tokens to your storage account`,
        `   • Funds are held securely in your account`,
        `   • You maintain full control and can withdraw anytime`,
        ``,
        `2. SET ALLOWANCES (Safety Limits):`,
        `   • Rate Allowance: Max spending per epoch (prevents runaway costs)`,
        `   • Lockup Allowance: Max total funds that can be locked`,
        `   • Max Lockup Period: Maximum duration for any payment rail`,
        ``,
        `3. AUTOMATIC DEDUCTION:`,
        `   • Every epoch (30 seconds), storage costs are calculated`,
        `   • Amount is automatically deducted from your balance`,
        `   • No manual payments, no invoices, fully automated`,
        ``,
        `4. MONITORING:`,
        `   • Check your balance anytime`,
        `   • See your burn rate (spending per day/month)`,
        `   • Get notified when balance is low`,
        `   • Top up as needed to avoid service interruption`,
        ``,
        `5. TRANSPARENCY:`,
        `   • All costs calculated on-chain`,
        `   • Real-time pricing information available`,
        `   • No surprise charges or hidden fees`,
        ``,
        `⚠️ CRITICAL - INSOLVENCY WARNING:`,
        `   • Storage providers consider accounts with LESS THAN 30 DAYS of`,
        `     remaining balance as INSOLVENT`,
        `   • Insolvent accounts may be REFUSED SERVICE or have data removed`,
        `   • ALWAYS maintain at least 45 days of balance for safety margin`,
        `   • Default notification threshold: 45 days (gives time to deposit)`,
        `   • Set up monitoring and alerts to avoid running low on funds`,
        ``,
      ].join('\n');

      return {
        success: true,
        pricingOverview,
        storageModel,
        cdnModel,
        exampleCalculation: {
          scenario: "Storing 1 TiB for 1 year" + (includeCDNExample ? " with CDN" : ""),
          size: "1 TiB (1,099,511,627,776 bytes)",
          duration: "12 months (1 year)",
          monthlyCost: `${(Number(estimate.monthlyCost) / 1e18).toFixed(4)} USDFC`,
          yearlyStorageCost: `${(Number(recurringStorageCost) / 1e18).toFixed(4)} USDFC`,
          cdnTopUp: includeCDNExample ? estimate.cdnSetupCostFormatted + " USDFC lockup" : undefined,
          cdnEgressCredits: includeCDNExample ? `~${cdnEgressCreditsGiB.toFixed(2)} GiB of downloads per 1 USDFC prepaid balance` : undefined,
          totalCost: estimate.totalCostFormatted + " USDFC",
          breakdown: exampleBreakdown.join('\n'),
        },
        paymentModel,
        message: `Storage pricing uses the live Synapse v1 price list. Example: 1 TiB for 1 year = ${estimate.totalCostFormatted} USDFC excluding refundable lockup${includeCDNExample ? ' (CDN egress: 1 USDFC prepaid balance covers ~' + cdnEgressCreditsGiB.toFixed(2) + ' GiB at current rates)' : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        message: `Failed to get pricing info: ${(error as Error).message}`,
      };
    }
  },
});

// Export all storage cost tools
export const storageCostTools = {
  estimateStoragePricing,
  convertStorageSize,
  getStoragePricingInfo,
};
