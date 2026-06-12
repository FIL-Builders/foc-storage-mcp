/**
 * Shared payment service for FOC storage operations
 */

import { account, client } from './viem';
import * as Payments from '@filoz/synapse-core/pay';
import { getPriceList as getWarmStoragePriceList } from '@filoz/synapse-core/warm-storage';
import { waitForTransactionReceipt } from 'viem/actions';
import { synapseErrorHandler } from '../lib/errors';
export interface PaymentResult {
  txHash: string | null;
  success: boolean;
  error?: string;
}
export interface WithdrawalResult {
  txHash: string | null;
  success: boolean;
  error?: string;
}
/**
 * Processes storage payment with EIP-2612 permit and operator approval
 * @param depositAmount Amount to deposit in base units (wei)
 * @returns Transaction result with hash and success status
 */
export async function processPaymentService(
  depositAmount: bigint,
): Promise<PaymentResult> {

  try {
    if (depositAmount === 0n) {
      const priceList = await getWarmStoragePriceList(client);
      const needsFwssMaxApproval = !(await Payments.isFwssMaxApproved(client, {
        clientAddress: account.address,
        requiredMaxLockupPeriod: priceList.lockups.defaultLockupPeriod,
      }));

      if (!needsFwssMaxApproval) {
        return { txHash: null, success: true };
      }
    }

    const hash = await Payments.fund(client, {
      amount: BigInt(depositAmount),
    });

    const receipt = await waitForTransactionReceipt(client, {
      hash,
    });

    return { txHash: hash, success: receipt.status === "success" };
  } catch (error: any) {
    return {
      txHash: null,
      success: false,
      error: synapseErrorHandler(error)
    };
  }
}

/**
 * Processes withdrawal from storage account
 * @param withdrawalAmount Amount to withdraw in base units (wei)
 * @returns Transaction result with hash and success status
 */
export async function processWithdrawalService(
  withdrawalAmount: bigint,
): Promise<WithdrawalResult> {
  try {
    const hash = await Payments.withdraw(client, {
      amount: BigInt(withdrawalAmount),
    });
    const receipt = await waitForTransactionReceipt(client, {
      hash,
    });
    return { txHash: hash, success: receipt.status === "success" };
  } catch (error: any) {
    return {
      txHash: null,
      success: false,
      error: synapseErrorHandler(error)
    };
  }
}
