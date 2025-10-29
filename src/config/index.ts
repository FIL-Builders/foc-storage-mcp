/**
 * Centralized configuration module for FOC Storage MCP Server
 * Validates environment variables at startup for fail-fast behavior
 */

// Load environment variables first
import { config } from 'dotenv';
config();

import { z } from 'zod';

const EnvSchema = z.object({
  PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required'),
  FILECOIN_NETWORK: z.enum(['mainnet', 'calibration']).default('calibration'),
  TOTAL_STORAGE_NEEDED_GiB: z.coerce.number().default(1024),
  PERSISTENCE_PERIOD_DAYS: z.coerce.number().default(365),
  RUNOUT_NOTIFICATION_THRESHOLD_DAYS: z.coerce.number().default(10),
});

export const env = EnvSchema.parse(process.env);

export const NETWORK_CONFIGS = {
  mainnet: {
    chainId: 314,
    name: 'Filecoin Mainnet',
    rpcUrl: 'https://api.node.glif.io/rpc/v1',
  },
  calibration: {
    chainId: 314159,
    name: 'Filecoin Calibration',
    rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
  },
} as const;

/**
 * Central constants file for FOC Storage MCP Server
 * Contains all numeric constants, configuration defaults, and magic numbers
 */

/** Max uint256 for Solidity unlimited approvals */
export const MAX_UINT256 = 2n ** 256n - 1n;

/** Dataset creation fee: 0.1 USDFC (prevents spam, covers network costs) */
export const DATA_SET_CREATION_FEE = BigInt(0.1 * 10 ** 18);

/** Merkle tree leaf size (32 bytes) for storage calculations */
export const LEAF_SIZE = 32n;

/** Bytes per TiB for size conversions */
export const BYTES_PER_TIB = 1024n * 1024n * 1024n * 1024n;

/** Bytes per GiB for size conversions */
export const BYTES_PER_GIB = 1024n * 1024n * 1024n;

/** Default expected storage capacity (1 TB) */
export const DEFAULT_EXPECTED_STORAGE_BYTES = 1024 * 1024 * 1024 * 1024;