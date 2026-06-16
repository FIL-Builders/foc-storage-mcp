/**
 * Centralized configuration module for FOC Storage MCP Server
 * Validates environment variables at startup for fail-fast behavior
 */

// Load environment variables first
import { config } from 'dotenv';
// Quiet mode to avoid stdout pollution that breaks MCP JSON protocol
config({ quiet: true });

import { z } from 'zod';

const EnvSchema = z.object({
  PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required'),
  FILECOIN_NETWORK: z.enum(['mainnet', 'calibration']).default('calibration'),
  SYNAPSE_SOURCE: z.string().min(1).default('foc-storage-mcp'),
  TOTAL_STORAGE_NEEDED_GiB: z.coerce.number().default(150),
  PERSISTENCE_PERIOD_DAYS: z.coerce.number().default(365).refine((value) => value >= 30, { message: 'PERSISTENCE_PERIOD_DAYS must be greater than or equal to 30' }),
  RUNOUT_NOTIFICATION_THRESHOLD_DAYS: z.coerce.number().default(45).refine((value) => value >= 30, { message: 'RUNOUT_NOTIFICATION_THRESHOLD_DAYS must be greater than or equal to 30' }),
});

export const env = {
  ...EnvSchema.parse(process.env),
}

/**
 * Central constants file for FOC Storage MCP Server
 * Contains all numeric constants, configuration defaults, and magic numbers
 */

/** Max uint256 for Solidity unlimited approvals */
export const MAX_UINT256 = 2n ** 256n - 1n;
