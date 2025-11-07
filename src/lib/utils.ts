import { promises as fs } from "fs";
import { env } from "@/config";

/**
 * Validates file path exists and returns file info
 */
export async function validateFilePath(filePath: string): Promise<{
    path: string;
    size: number;
}> {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            throw new Error(`Path is not a file: ${filePath}`);
        }
        return {
            path: filePath,
            size: stats.size,
        };
    } catch (error) {
        throw new Error(`File not found or inaccessible: ${filePath}`);
    }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
    errorType: string,
    message: string,
    additionalData?: Record<string, unknown>
): { success: false; error: string; message: string } {
    return {
        success: false,
        error: errorType,
        message,
        ...additionalData,
    };
}

/**
 * Convert human-readable amount to wei/smallest unit
 */
export function toBaseUnits(amount: string, decimals: number = 18): bigint {
    const [whole, decimal = ""] = amount.split(".");
    const paddedDecimal = decimal.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole + paddedDecimal);
}

/**
 * Convert wei/smallest unit to human-readable amount
 */
export function fromBaseUnits(amount: bigint, decimals: number = 18): string {
    const str = amount.toString().padStart(decimals + 1, "0");
    const whole = str.slice(0, -decimals) || "0";
    const decimal = str.slice(-decimals).replace(/0+$/, "");
    return decimal ? `${whole}.${decimal}` : whole;
}

export function serializeBigInt<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return obj.toString() as unknown as T;
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeBigInt) as unknown as T;
    }
    if (typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)])
        ) as unknown as T;
    }
    return obj;
}

/**
 * Generates a block explorer URL for a transaction hash based on the current network
 * @param txHash - Transaction hash (with or without 0x prefix)
 * @returns Block explorer URL for the transaction
 */
export function getExplorerUrl(txHash: string): string {
    const isMainnet = env.FILECOIN_NETWORK === 'mainnet';
    const baseUrl = isMainnet
        ? 'https://filecoin.blockscout.com/tx'
        : 'https://filecoin-testnet.blockscout.com/tx';

    return `${baseUrl}/${txHash}`;
}

/**
 * Formats transaction hash with explorer link for console logging
 * @param txHash - Transaction hash
 * @returns Formatted string with hash and explorer link
 */
export function formatTxWithExplorer(txHash: string | null): string {
    if (!txHash) return 'No transaction hash available';

    const explorerUrl = getExplorerUrl(txHash);
    return `Transaction: ${txHash}\nView on explorer: ${explorerUrl}`;
}