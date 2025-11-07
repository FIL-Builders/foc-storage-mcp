import { readProviders, getProvider as readProvider } from "@filoz/synapse-core/warm-storage";
import { client, publicClient } from "./viem";
import { serializeBigInt } from "@/lib";

/**
 * Retrieves all active storage providers from the blockchain
 * @returns Array of active storage providers
 */
export const getProviders = async () => {
    const providers = (await readProviders(
        client,
    )).filter((p) => p.isActive);

    return providers;
}

/**
 * Retrieves a specific storage provider by ID
 * @param providerId Provider identifier
 * @returns Provider details with serialized BigInt values
 */
export const getProvider = async (providerId: number) => {
    const provider = await readProvider(publicClient, {
        providerId: BigInt(providerId),
    });
    return serializeBigInt(provider);
}
