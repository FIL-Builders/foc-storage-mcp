import { createTool } from "@mastra/core";
import { z } from "zod";
import { estimateStorageCost } from "@/services/storage-service";
import { SIZE_CONSTANTS } from "@filoz/synapse-core/utils";
import { CDN_EGRESS_RATE_PER_TIB } from "@/config";

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
    .describe('Whether this is for a new CDN-enabled dataset (adds 1 USDFC one-time cost). Default: false'),
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
    .describe('One-time CDN setup cost in USDFC (if createCDNDataset is true)'),
  cdnEgressCredits: z.string().optional()
    .describe('CDN egress credits topped up (in GiB) with the 1 USDFC setup cost'),
  details: z.object({
    sizeInBytes: z.number(),
    sizeFormatted: z.string().describe('Human-readable size (e.g., "1.50 GiB")'),
    durationInMonths: z.number(),
    pricePerTiBPerMonth: z.string(),
    minimumPricePerMonth: z.string(),
    appliedMinimum: z.boolean().describe('Whether minimum pricing was applied (for storage < 24.567 GiB)'),
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
 * Calculates storage costs based on Filecoin OnchainCloud pricing:
 * - Storage: $2.50/TiB/month
 * - Minimum: $0.06/month (for storage < 24.567 GiB)
 * - CDN Setup: 1 USDFC one-time (only for new CDN datasets)
 * - Epochs: 30 seconds each
 */
export const estimateStoragePricing = createTool({
  id: "estimateStoragePricing",
  description:
    "Calculate storage costs for Filecoin OnchainCloud and explain pricing models. Provides: (1) Cost estimates with monthly/total breakdowns, (2) Comprehensive explanation of storage pricing (pay-per-epoch, $2.50/TiB/month, $0.06 minimum), (3) CDN egress pricing details ($7/TiB downloads, 1 USDFC = ~146 GiB credits). ⚠️ CRITICAL: When explaining budgeting, ALWAYS warn that storage providers consider accounts with less than 30 days of remaining balance as INSOLVENT and may refuse service. Recommend maintaining at least 45 days of balance for safety margin. Use when users ask about storage costs, pricing models, CDN fees, or need to budget for storage. Clarifies that CDN 1 USDFC is NOT a fee but pre-paid egress credits that can be topped up anytime.",
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

      // Calculate CDN egress credits (1 USDFC = ~146 GiB at $7/TiB rate)
      // 1 USDFC buys (1/CDN_EGRESS_RATE_PER_TIB) * 1024 GiB = ~146.29 GiB of egress
      const cdnEgressCreditsGiB = createCDNDataset ? (1 / CDN_EGRESS_RATE_PER_TIB) * 1024 : 0;

      // Create a human-readable breakdown
      const breakdown = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Storage Cost Estimate for ${estimate.details.sizeFormatted}`,
        `Duration: ${durationInMonths} month${durationInMonths !== 1 ? 's' : ''}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Monthly Storage Cost: ${Number(estimate.monthlyCost) / 1e18} USDFC`,
        `Total Storage Cost: ${Number(estimate.totalCost - estimate.cdnSetupCost) / 1e18} USDFC`,
      ];

      if (createCDNDataset && estimate.cdnSetupCost > 0n) {
        breakdown.push(``);
        breakdown.push(`CDN Egress Credits Top-up: ${estimate.cdnSetupCostFormatted} USDFC`);
        breakdown.push(`  → Provides ~${cdnEgressCreditsGiB.toFixed(2)} GiB of egress credits`);
        breakdown.push(`  → You can top up more credits anytime`);
        breakdown.push(``);
        breakdown.push(`Grand Total (Storage + CDN Credits): ${estimate.totalCostFormatted} USDFC`);
      }

      breakdown.push(``);
      breakdown.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      if (estimate.details.appliedMinimum) {
        breakdown.push(
          `Note: Minimum pricing of $0.06/month applied (storage < ~24.567 GiB)`
        );
      }

      // Pricing explanation
      const pricingExplanation = [
        ``,
        `HOW STORAGE PRICING WORKS:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Storage operates on a pay-per-epoch model (epochs are 30 seconds):`,
        ``,
        `1. BASE RATE: $2.50 per TiB per month`,
        `   - Calculated per epoch: (size / TiB) × $2.50/month ÷ epochs_per_month`,
        `   - You pay only for the storage space you use`,
        ``,
        `2. MINIMUM CHARGE: $0.06 per month`,
        `   - Applies to storage < ~24.567 GiB`,
        `   - Ensures service sustainability for small datasets`,
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
        `1. EGRESS RATE: $7 per TiB downloaded`,
        `   - ~$0.0068 per GiB downloaded`,
        `   - Only pay for actual data transferred`,
        ``,
        `2. CDN CREDITS TOP-UP (Not a Fee!):`,
        `   - Creating a new CDN dataset requires 1 USDFC top-up`,
        `   - This is NOT a fee - it's pre-paid egress credits`,
        `   - 1 USDFC = ~146.29 GiB of download credits`,
        `   - Credits are deducted as files are downloaded`,
        ``,
        `3. REUSING DATASETS:`,
        `   - Adding files to existing CDN dataset = NO additional top-up`,
        `   - Only the first dataset creation requires the 1 USDFC top-up`,
        `   - Your egress credits work across all your CDN datasets`,
        ``,
        `4. TOPPING UP CREDITS:`,
        `   - Top up anytime to avoid running out`,
        `   - Monitor your remaining egress credits`,
        `   - No expiration on credits`,
        ``,
        `5. EXAMPLE CALCULATIONS:`,
        `   - 1 USDFC → ~146 GiB of downloads`,
        `   - 10 USDFC → ~1.43 TiB of downloads`,
        `   - 70 USDFC → ~10 TiB of downloads`,
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
        cdnEgressCredits: createCDNDataset ? `${cdnEgressCreditsGiB.toFixed(2)} GiB (~${(cdnEgressCreditsGiB / 1024).toFixed(4)} TiB)` : '0 GiB',
        details: {
          ...estimate.details,
          pricePerTiBPerMonth: estimate.details.pricePerTiBPerMonth.toString(),
          minimumPricePerMonth: estimate.details.minimumPricePerMonth.toString(),
        },
        breakdown: breakdown.join('\n'),
        pricingExplanation,
        cdnPricingExplanation,
        message: `Estimated cost: ${estimate.totalCostFormatted} USDFC for ${estimate.details.sizeFormatted} over ${durationInMonths} month${durationInMonths !== 1 ? 's' : ''}${createCDNDataset ? ' (includes 1 USDFC CDN egress credits top-up = ~' + cdnEgressCreditsGiB.toFixed(2) + ' GiB of downloads)' : ''}`,
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
export const convertStorageSize = createTool({
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
export const getStoragePricingInfo = createTool({
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
      minimumCharge: z.string(),
      minimumThreshold: z.string(),
      epochDuration: z.string(),
      epochsPerDay: z.number(),
      epochsPerMonth: z.number(),
    }).optional(),
    cdnModel: z.object({
      egressRate: z.string(),
      creditsTopUp: z.string(),
      creditsPerUSDFC: z.string(),
      isTopUpAFee: z.boolean(),
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

      const cdnEgressCreditsGiB = includeCDNExample ? (1 / CDN_EGRESS_RATE_PER_TIB) * 1024 : 0;

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
        `  • No hidden fees, no minimum contracts, no lock-in periods`,
        ``,
      ].join('\n');

      const storageModel = {
        baseRate: "$2.50 per TiB per month",
        minimumCharge: "$0.06 per month",
        minimumThreshold: "~24.567 GiB (applies to storage smaller than this)",
        epochDuration: "30 seconds",
        epochsPerDay: 2880,
        epochsPerMonth: 86400, // 30 days
      };

      const cdnModel = includeCDNExample ? {
        egressRate: "$7 per TiB downloaded (~$0.0068 per GiB)",
        creditsTopUp: "1 USDFC required when creating first CDN dataset",
        creditsPerUSDFC: "~146.29 GiB of egress credits",
        isTopUpAFee: false,
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
        `  Base Rate: $2.50/TiB/month`,
        `  Calculation: 1 TiB × $2.50/month × 12 months`,
        `  Monthly Cost: ${(Number(estimate.monthlyCost) / 1e18).toFixed(4)} USDFC`,
        `  Yearly Storage: ${(Number(estimate.totalCost - estimate.cdnSetupCost) / 1e18).toFixed(4)} USDFC`,
        ``,
      ];

      if (includeCDNExample) {
        exampleBreakdown.push(
          `CDN EGRESS CREDITS (Optional):`,
          `  Initial Top-up: 1.0 USDFC (pre-paid credits, NOT a fee)`,
          `  Provides: ~${cdnEgressCreditsGiB.toFixed(2)} GiB of download credits`,
          `  Reusing dataset: No additional top-up required`,
          `  Additional top-ups: Available anytime`,
          ``,
        );
      }

      exampleBreakdown.push(
        `TOTAL COST:`,
        `  Storage (12 months): ${(Number(estimate.totalCost - estimate.cdnSetupCost) / 1e18).toFixed(4)} USDFC`,
      );

      if (includeCDNExample) {
        exampleBreakdown.push(
          `  CDN Credits Top-up: ${estimate.cdnSetupCostFormatted} USDFC`,
          `  ────────────────────`,
          `  Grand Total: ${estimate.totalCostFormatted} USDFC`,
          ``,
          `Note: The CDN top-up gives you ${cdnEgressCreditsGiB.toFixed(2)} GiB of downloads.`,
          `      If you download your 1 TiB once, you'd need ~7 USDFC more in credits.`,
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
          yearlyStorageCost: `${(Number(estimate.totalCost - estimate.cdnSetupCost) / 1e18).toFixed(4)} USDFC`,
          cdnTopUp: includeCDNExample ? estimate.cdnSetupCostFormatted + " USDFC" : undefined,
          cdnEgressCredits: includeCDNExample ? `~${cdnEgressCreditsGiB.toFixed(2)} GiB of downloads` : undefined,
          totalCost: estimate.totalCostFormatted + " USDFC",
          breakdown: exampleBreakdown.join('\n'),
        },
        paymentModel,
        message: `Storage pricing: $2.50/TiB/month (minimum $0.06/month). Example: 1 TiB for 1 year = ${estimate.totalCostFormatted} USDFC${includeCDNExample ? ' (includes 1 USDFC CDN credits = ~' + cdnEgressCreditsGiB.toFixed(2) + ' GiB downloads)' : ''}`,
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
