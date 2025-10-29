import { createTool } from '@mastra/core';
import { GetBalancesOutputSchema, GetBalancesSchema } from '@/types';
import { env } from '@/config';
import { getSynapseInstance, serializeBigInt } from '@/lib';
import { checkStorageBalance, formatStorageBalanceResult } from '@/services';
import { createErrorResponse } from '@/lib';

/**
 * Balance tools for FOC storage operations.
 */

export const getBalances = createTool({
  id: 'getBalances',
  description: 'Check wallet balances (FIL and USDFC tokens) and comprehensive storage metrics including available funds, required deposits, days of storage remaining, and allowance status. Returns both human-readable formatted values and raw data. Use this before upload operations to verify sufficient balance, or to monitor storage budget and plan deposits. Calculates storage needs based on capacity and persistence period parameters.',
  inputSchema: GetBalancesSchema,
  outputSchema: GetBalancesOutputSchema,
  execute: async ({ context }) => {
    try {
      const synapse = await getSynapseInstance();

      const checkStorageBalanceResult = await checkStorageBalance(synapse, context.storageCapacityBytes, env.PERSISTENCE_PERIOD_DAYS);
      return {
        success: true,
        checkStorageBalanceResultFormatted: (formatStorageBalanceResult(checkStorageBalanceResult)),
        checkStorageBalanceResult: serializeBigInt(checkStorageBalanceResult),
      };
    } catch (error) {
      return createErrorResponse(
        'balance_fetch_failed',
        `Failed to fetch balances: ${(error as Error).message}`,
        { success: false }
      ) as any;
    }
  },
});

// Export all balance tools
export const balanceTools = {
  getBalances,
};
