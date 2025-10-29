import { promises as fs } from "fs";
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