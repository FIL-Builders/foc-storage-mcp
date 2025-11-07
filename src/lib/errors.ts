import { env } from '@/config';

/**
 * Error handling and transaction utilities for FOC storage operations
 */

/**
 * Formats a user-friendly message for balance top-up instructions
 * @param isTestnet - Whether the operation is on a testnet
 * @returns Formatted top-up instructions for the user
 */
export function getTopUpMessage(isTestnet: boolean): string {
    if (isTestnet) {
        return `
To resolve insufficient balance errors:
" For tFIL: Visit https://faucet.calibration.fildev.network/
" For tUSDFC: Visit https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc
`;
    }
    return `
To resolve insufficient balance errors:
" Top up your FIL or USDFC balance
" Ensure you have sufficient funds for the operation
`;
}

/**
 * Handles and formats errors from Synapse operations
 * @param error - The error object from the failed operation
 * @param isTestnet - Whether the operation is on a testnet
 * @returns A formatted error message with actionable information
 */
export function synapseErrorHandler(error: any): string {
    const errorParts: string[] = ['Payment processing failed'];

    // Extract relevant error information
    if (error?.cause) {
        const cause = typeof error.cause === 'string'
            ? error.cause
            : JSON.stringify(error.cause);
        errorParts.push(`Cause: ${cause}`);
    }

    if (error?.shortMessage) {
        errorParts.push(`Message: ${error.shortMessage}`);
    }

    if (error?.details) {
        errorParts.push(`Details: ${error.details}`);
    }
    const isTestnet = env.FILECOIN_NETWORK === 'calibration';

    errorParts.push(getTopUpMessage(isTestnet));

    return errorParts.join('\n');
}
