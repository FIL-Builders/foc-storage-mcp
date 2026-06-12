import { createTool } from "@mastra/core";
import { ProcessPaymentOutputSchema, ProcessPaymentSchema, ProcessWithdrawalOutputSchema, ProcessWithdrawalSchema } from "@/types";
import { toBaseUnits, fromBaseUnits, getExplorerUrl } from "@/lib";
import { checkStorageBalance } from "@/services";
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
    let amount = toBaseUnits(depositAmount.toString(), 18);

    let isApprovalOnly = false;
    if (amount === 0n) {
      log("No explicit deposit amount provided, checking current storage funding requirements...");
      const storageBalance = await checkStorageBalance();
      amount = storageBalance.depositNeeded;
      if (amount > 0n) {
        log(`Calculated deposit needed: ${fromBaseUnits(amount, 18)} USDFC`);
      } else if (storageBalance.isSufficient) {
        log("Storage account already has sufficient funds and service approval");
      } else {
        isApprovalOnly = true;
        log("Deposit is sufficient, but service approval still needs to be set");
      }
    }

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
      message: amount > 0n
        ? `Payment processed successfully. You deposited ${fromBaseUnits(amount, 18)} USDFC to your storage account.`
        : isApprovalOnly
          ? "Service approval processed successfully. No additional USDFC deposit was required."
          : "Storage account funding and service approval are already sufficient.",
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
