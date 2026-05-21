import { getPDPProviders, getPDPProvider } from "@filoz/synapse-core/sp-registry";
import { publicClient } from "./viem";
import { serializeBigInt } from "@/lib";

/**
 * Retrieves all active storage providers from the blockchain
 * @returns Array of active storage providers
 */
export const getProviders = async () => {
    const { providers } = await getPDPProviders(publicClient);
    return providers.filter((p) => p.isActive);
}

/**
 * Retrieves a specific storage provider by ID
 * @param providerId Provider identifier
 * @returns Provider details with serialized BigInt values
 */
export const getProvider = async (providerId: bigint | number) => {
    const provider = await getPDPProvider(publicClient, {
        providerId: BigInt(providerId),
    });
    if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
    }
    return serializeBigInt(provider);
}

/**
 * Retrieves the raw provider record (BigInt fields preserved)
 * @param providerId Provider identifier
 */
export const getProviderRaw = async (providerId: bigint | number) => {
    const provider = await getPDPProvider(publicClient, {
        providerId: BigInt(providerId),
    });
    if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
    }
    return provider;
}
