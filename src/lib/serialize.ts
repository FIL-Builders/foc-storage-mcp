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