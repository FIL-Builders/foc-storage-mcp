import { createTool } from "@mastra/core";
import { ProcessPaymentOutputSchema, ProcessPaymentSchema, TOKENS } from "@/types";
import { env } from "@/config";
import {
  getSynapseInstance,
  createErrorResponse,
} from "@/lib";
import { processStoragePayment } from "@/services";

/**
 * Payment tools for FOC storage operations.
 */

export const processPayment = createTool({
  id: "processPayment",
  description:
    "Deposit USDFC tokens and configure storage service allowances in a single transaction using EIP-2612 gasless permits. Sets both rate allowance (per-epoch spending limit) and lockup allowance (total committed funds) to unlimited for seamless storage operations. Use this to fund your storage account before uploads or when balance is insufficient. Validates wallet balance before processing to prevent failed transactions.",
  inputSchema: ProcessPaymentSchema,
  outputSchema: ProcessPaymentOutputSchema,
  execute: async ({ context }) => {
    try {
      const synapse = await getSynapseInstance();

      const accountInfo = await synapse.payments.accountInfo(TOKENS.USDFC);
      const availableFunds = Number(accountInfo.availableFunds);
      const { depositAmount } = context;

      if (depositAmount === 0) {
        return {
          success: true,
          message: `You have sufficient balance to cover the storage needs.`,
          txHash: null,
          required: {
            deposit: depositAmount,
          },
          available: availableFunds,
        };
      }

      if (availableFunds < depositAmount) {
        return {
          success: false,
          error: "insufficient_balance",
          message: `Insufficient USDFC balance. Required: ${depositAmount}, Available: ${availableFunds}`,
          required: depositAmount,
          available: Number(availableFunds),
        } as any;
      }

      // Process payment with EIP-2612 permit (single transaction)
      const result = await processStoragePayment(
        synapse,
        BigInt(depositAmount),
        env.PERSISTENCE_PERIOD_DAYS
      );

      return {
        success: result.success,
        txHash: result.txHash,
        message: `Payment processed successfully now you can upload files to storage. You paid ${depositAmount} USDFC to cover the storage needs.`,
      };
    } catch (error) {
      return createErrorResponse(
        "payment_failed",
        `Payment processing failed: ${(error as Error).message}`,
        { success: false }
      );
    }
  },
});

// Export all payment tools
export const paymentTools = {
  processPayment,
};
