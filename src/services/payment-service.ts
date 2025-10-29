/**
 * Shared payment service for FOC storage operations
 * Centralizes payment and approval logic to avoid duplication
 */

import { Synapse, TIME_CONSTANTS } from '@filoz/synapse-sdk';
import { MAX_UINT256 } from '@/config';

export interface PaymentResult {
  txHash: string;
  success: boolean;
}

/**
 * Processes storage payment with EIP-2612 permit and operator approval
 * Handles both deposit (when amount > 0) and approval-only scenarios
 *
 * @param synapse - Initialized Synapse SDK instance
 * @param depositAmount - Amount to deposit in base units (attoFIL), 0 for approval-only
 * @param persistenceDays - Number of days to persist storage
 * @returns Transaction hash and success status
 * @throws If wallet balance insufficient or transaction fails
 */
export async function processStoragePayment(
  synapse: Synapse,
  depositAmount: bigint,
  persistenceDays: number
): Promise<PaymentResult> {
  const warmStorageAddress = synapse.getWarmStorageAddress();
  const epochs = TIME_CONSTANTS.EPOCHS_PER_DAY * BigInt(persistenceDays);

  if (depositAmount > 0n) {
    const tx = await synapse.payments.depositWithPermitAndApproveOperator(
      depositAmount,
      warmStorageAddress,
      MAX_UINT256,
      MAX_UINT256,
      epochs
    );
    const receipt = await tx.wait(1);
    return { txHash: receipt?.hash || tx.hash, success: true };
  } else {
    const tx = await synapse.payments.approveService(
      warmStorageAddress,
      MAX_UINT256,
      MAX_UINT256,
      epochs
    );
    const receipt = await tx.wait(1);
    return { txHash: receipt?.hash || tx.hash, success: true };
  }
}
