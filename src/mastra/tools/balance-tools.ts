import { createTool } from "@mastra/core";
import { GetBalancesOutputSchema, GetBalancesSchema } from '@/types';
import { env } from '@/config';
import { serializeBigInt, synapseErrorHandler } from '@/lib';
import { checkStorageBalance, formatStorageBalanceResult, defaultStorageBalanceResult, defaultStorageBalanceResultFormatted } from '@/services';

/**
 * Balance tools for FOC storage operations.
 */
export const getBalances = createTool({
  id: 'getBalances',
  description: 'Check wallet balances (FIL and USDFC tokens) and comprehensive storage metrics including available funds, required deposits, days of storage remaining, and allowance status. Returns both human-readable formatted values and raw data with progress log showing calculation parameters used. ⚠️ CRITICAL: Storage providers consider accounts with less than 30 days of available balance as INSOLVENT and may refuse service. Default notice period is 45 days to ensure safe margin. IMPORTANT AGENT INSTRUCTIONS: (1) Before calling this tool, ASK the user if they want to calculate based on default storage requirements (150 GiB capacity, 365 days persistence, 45 days notice period) or if they have specific requirements. (2) After showing results, ALWAYS ASK the user if they want to see calculations for different storage configurations. (3) If days remaining falls below 45, WARN the user that they are approaching insolvency threshold (30 days) and should deposit funds immediately. Use this before upload operations to verify sufficient balance, or to monitor storage budget and plan deposits.',
  inputSchema: GetBalancesSchema,
  outputSchema: GetBalancesOutputSchema,
  execute: async ({ context }) => {
    const progressLog: string[] = [];
    const log = (msg: string) => { progressLog.push(msg); };

    try {
      const storageCapacityBytes = context.storageCapacityBytes || (env.TOTAL_STORAGE_NEEDED_GiB * 1024 * 1024 * 1024);
      const persistencePeriodDays = context.persistencePeriodDays || env.PERSISTENCE_PERIOD_DAYS;
      const notificationThresholdDays = context.notificationThresholdDays || env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS;

      // Log calculation parameters
      const capacityGB = (storageCapacityBytes / (1024 * 1024 * 1024)).toFixed(2);
      const capacityTB = (storageCapacityBytes / (1024 * 1024 * 1024 * 1024)).toFixed(2);

      log(`Calculating balance requirements with:`);
      log(`- Storage Capacity: ${capacityGB} GB (${capacityTB} TB)`);
      log(`- Persistence Period: ${persistencePeriodDays} days`);
      log(`- Notification Threshold: ${notificationThresholdDays} days`);

      log("Fetching wallet balances from blockchain...");
      const checkStorageBalanceResult = await checkStorageBalance(storageCapacityBytes, persistencePeriodDays);

      log("Calculating storage metrics and requirements...");
      const formattedResult = formatStorageBalanceResult(checkStorageBalanceResult);
      const serializedResult = serializeBigInt(checkStorageBalanceResult);

      log(`Balance check complete. Available USDFC: ${formattedResult.usdfcBalance}`);

      // Check for insolvency warning
      const daysLeft = checkStorageBalanceResult.daysLeftAtBurnRate;
      if (daysLeft < 45) {
        if (daysLeft < 30) {
          log(`⛔ CRITICAL INSOLVENCY WARNING: Only ${daysLeft.toFixed(1)} days of balance remaining! Storage providers consider accounts with less than 30 days as INSOLVENT and will REFUSE SERVICE. Deposit funds IMMEDIATELY!`);
        } else {
          log(`⚠️ LOW BALANCE WARNING: Only ${daysLeft.toFixed(1)} days remaining (threshold: 45 days). You are approaching the insolvency threshold (30 days). Please deposit funds soon to avoid service interruption.`);
        }
      }

      // Ask user if they want different calculations
      log("💡 To calculate for different storage requirements, call this tool again with custom storageCapacityBytes and persistencePeriodDays parameters.");

      return {
        success: true,
        checkStorageBalanceResultFormatted: formattedResult,
        checkStorageBalanceResult: serializedResult as any,
        progressLog,
        message: `Balance check complete for ${capacityTB} TB over ${persistencePeriodDays} days. Available: ${formattedResult.usdfcBalance}`,
      };
    } catch (error) {
      return {
        success: false,
        checkStorageBalanceResultFormatted: defaultStorageBalanceResultFormatted,
        checkStorageBalanceResult: serializeBigInt(defaultStorageBalanceResult) as any,
        error: synapseErrorHandler(error),
        message: `Failed to fetch balances: ${(error as Error).message}`,
        progressLog,
      };
    }
  },
});

// Export all balance tools
export const balanceTools = {
  getBalances,
};
