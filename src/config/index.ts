/**
 * Centralized configuration module for FOC Storage MCP Server
 * Validates environment variables at startup for fail-fast behavior
 */

// Load environment variables first
import { calibration, mainnet } from '@filoz/synapse-core/chains';

import { config } from 'dotenv';
config();

import { z } from 'zod';

const EnvSchema = z.object({
  PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required'),
  FILECOIN_NETWORK: z.enum(['mainnet', 'calibration']).default('calibration'),
  TOTAL_STORAGE_NEEDED_GiB: z.coerce.number().default(150),
  PERSISTENCE_PERIOD_DAYS: z.coerce.number().default(365).refine((value) => value >= 30, { message: 'PERSISTENCE_PERIOD_DAYS must be greater than or equal to 30' }),
  RUNOUT_NOTIFICATION_THRESHOLD_DAYS: z.coerce.number().default(45).refine((value) => value >= 30, { message: 'RUNOUT_NOTIFICATION_THRESHOLD_DAYS must be greater than or equal to 30' }),
});

export const env = {
  ...EnvSchema.parse(process.env), ...{
    CDN_DATASET_FEE: 10n ** 18n,
  }
}

export const NETWORK_CONFIGS = {
  mainnet: {
    chainId: 314,
    name: 'Filecoin Mainnet',
    rpcUrl: mainnet.rpcUrls.default.http,
  },
  calibration: {
    chainId: 314159,
    name: 'Filecoin Calibration',
    rpcUrl: calibration.rpcUrls.default.http,
  },
} as const;

export const CONTRACTS = env.FILECOIN_NETWORK === 'calibration' ? calibration.contracts : mainnet.contracts;

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

/** CDN egress rate: $7 per TiB */
export const CDN_EGRESS_RATE_PER_TIB = 7;

/** Default expected storage capacity (1 TB) */
export const DEFAULT_EXPECTED_STORAGE_BYTES = 1024 * 1024 * 1024 * 1024;