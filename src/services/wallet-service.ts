import { ethers, Wallet, JsonRpcProvider } from 'ethers';
import type { Signer } from 'ethers';
import { env, NETWORK_CONFIGS } from '@/config';

/**
 * Wallet configuration and signer management.
 * Uses ethers.js to create signer from private key in environment variables.
 */

export type NetworkType = keyof typeof NETWORK_CONFIGS;

/**
 * Get network configuration from environment
 */
export function getNetworkConfig(): { network: NetworkType; config: typeof NETWORK_CONFIGS[NetworkType] } {
  const network = env.FILECOIN_NETWORK as NetworkType;

  return {
    network,
    config: NETWORK_CONFIGS[network],
  };
}

/**
 * Create ethers signer from private key in environment
 */
export function createSigner(): Signer {
  const privateKey = env.PRIVATE_KEY;

  // Ensure private key has 0x prefix
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

  // Validate private key format
  try {
    if (formattedKey.length !== 66) {
      throw new Error('Private key must be 64 hex characters (32 bytes)');
    }
  } catch (error) {
    throw new Error(`Invalid PRIVATE_KEY format: ${(error as Error).message}`);
  }

  // Get network configuration
  const { network, config } = getNetworkConfig();
  const rpcUrl = process.env.FILECOIN_RPC_URL || config.rpcUrl;

  // Create provider
  const provider = new JsonRpcProvider(rpcUrl, {
    chainId: config.chainId,
    name: config.name,
  });

  // Create wallet (signer) from private key
  const wallet = new Wallet(formattedKey, provider);

  console.log(`[Wallet] Initialized on ${config.name} (chainId: ${config.chainId})`);
  console.log(`[Wallet] Address: ${wallet.address}`);
  console.log(`[Wallet] RPC: ${rpcUrl}`);

  return wallet;
}

/**
 * Get wallet address from signer
 */
export async function getWalletAddress(signer: Signer): Promise<string> {
  return await signer.getAddress();
}

/**
 * Get wallet balance (FIL) from signer
 */
export async function getWalletBalance(signer: Signer): Promise<bigint> {
  if (!signer.provider) {
    throw new Error('Signer does not have a provider');
  }
  const address = await signer.getAddress();
  return await signer.provider.getBalance(address);
}

/**
 * Validate wallet connection and balance
 */
export async function validateWallet(signer: Signer): Promise<{
  valid: boolean;
  address?: string;
  balance?: string;
  network?: string;
  error?: string;
}> {
  try {
    const address = await getWalletAddress(signer);
    const balanceWei = await getWalletBalance(signer);
    const balanceEth = ethers.formatEther(balanceWei);
    const { config } = getNetworkConfig();

    return {
      valid: true,
      address,
      balance: `${balanceEth} FIL`,
      network: config.name,
    };
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
    };
  }
}

// Global signer instance (lazy initialization)
let globalSigner: Signer | null = null;

/**
 * Get or create global signer instance
 */
export function getSigner(): Signer {
  if (!globalSigner) {
    globalSigner = createSigner();
  }
  return globalSigner;
}

/**
 * Reset global signer (useful for testing or re-initialization)
 */
export function resetSigner(): void {
  globalSigner = null;
}
