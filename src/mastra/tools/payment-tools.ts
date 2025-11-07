import { createTool } from "@mastra/core";
import { ProcessPaymentOutputSchema, ProcessPaymentSchema, ProcessWithdrawalOutputSchema, ProcessWithdrawalSchema } from "@/types";
import { toBaseUnits, getExplorerUrl } from "@/lib";
import { processPaymentService, processWithdrawalService } from "@/services/payment-service";

/**
 * Payment tools for FOC storage operations.
 */

export const processPayment = createTool({
  id: "processPayment",
  description:
    "Deposit USDFC tokens (not in base units) and configure storage service allowances in a single transaction using EIP-2612 gasless permits. Sets both rate allowance (per-epoch spending limit) and lockup allowance (total committed funds) to unlimited for seamless storage operations. Use this to fund your storage account before uploads or when balance is insufficient. Validates wallet balance before processing to prevent failed transactions.",
  inputSchema: ProcessPaymentSchema,
  outputSchema: ProcessPaymentOutputSchema,
  execute: async ({ context }) => {
    const progressLog: string[] = [];
    const log = (msg: string) => { progressLog.push(msg); };

    const { depositAmount } = context;

    log("Converting amount to base units...");
    const amount = toBaseUnits(depositAmount.toString(), 18);

    log("Initiating payment transaction...");
    const { success, txHash, error } = await processPaymentService(amount);

    if (!success) {
      return {
        success: false,
        error: "payment_failed",
        message: `Failed to process payment: ${error}`,
        progressLog,
      };
    }

    log("Payment transaction confirmed");
    if (txHash) {
      log(`View transaction: ${getExplorerUrl(txHash)}`);
    }
    return {
      success,
      txHash,
      message: `Payment processed successfully. You deposited ${depositAmount} USDFC to your storage account.`,
      progressLog,
    };
  },
});

export const processWithdrawal = createTool({
  id: "processWithdrawal",
  description:
    "Withdraw USDFC tokens (not in base units) from the storage account back to your wallet. Reduces storage service allowances and available balance. Use this to retrieve unused funds from the storage account. Returns transaction hash for verification and progress tracking through conversion, initiation, and confirmation steps.",
  inputSchema: ProcessWithdrawalSchema,
  outputSchema: ProcessWithdrawalOutputSchema,
  execute: async ({ context }) => {
    const progressLog: string[] = [];
    const log = (msg: string) => { progressLog.push(msg); };

    const { withdrawalAmount } = context;

    log("Converting amount to base units...");
    const amount = toBaseUnits(withdrawalAmount.toString(), 18);

    log("Initiating withdrawal transaction...");
    const { success, txHash, error } = await processWithdrawalService(amount);

    if (!success) {
      return {
        success: false,
        error: "withdrawal_failed",
        message: `Failed to process withdrawal: ${error}`,
        progressLog,
      };
    }

    log("Withdrawal transaction confirmed");
    if (txHash) {
      log(`View transaction: ${getExplorerUrl(txHash)}`);
    }
    return {
      success: true,
      txHash: txHash,
      message: `Withdrawal processed successfully. You withdrew ${withdrawalAmount} USDFC from your storage account.`,
      progressLog,
    };
  },
});

// Export all payment tools
export const paymentTools = {
  processPayment,
  processWithdrawal,
};
