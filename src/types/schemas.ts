/**
 * Zod validation schemas for FOC Storage tools
 * AI-agent friendly input validation schemas
 */

import { z } from 'zod';
import { env } from '@/config';
import { SIZE_CONSTANTS } from '@filoz/synapse-core/utils';
import { DataSetWithPieces } from '@filoz/synapse-react';
import { PDPProvider } from '@filoz/synapse-core/warm-storage';
// Dataset tools schemas
export const GetDatasetsSchema = z.object({
  includeAllDatasets: z.boolean().optional().default(true)
    .describe('Include all datasets. Default: true'),
  filterByCDN: z.boolean().optional()
    .describe('Filter to only CDN-enabled datasets. Default: false. If includeAllDatasets is true, this will be ignored')
});

export const GetDatasetSchema = z.object({
  datasetId: z.string()
    .describe('Dataset ID to get.'),
});

export const CreateDatasetSchema = z.object({
  withCDN: z.boolean().optional().default(false)
    .describe('Enable CDN for faster file retrieval. Default: false. Recommended for frequently accessed files'),
  providerId: z.string().optional()
    .describe('Specific storage provider ID. If not specified, best provider will be auto-selected'),
  // Metadata for the dataset - allows up to 10 string key-value pairs
  metadata: z.record(z.string(), z.string()).optional()
    .refine((data) => !data || Object.keys(data).length <= 10, {
      message: "Metadata can contain at most 10 key-value pairs"
    })
    .describe('Metadata for the dataset. Supports up to 10 string key-value pairs where both keys and values must be strings'),
});

// File upload schema
export const UploadFileSchema = z.object({
  filePath: z.string()
    .describe('Absolute path to file on local filesystem to upload'),
  fileName: z.string().optional()
    .describe('Custom filename for storage. If not provided, uses original filename'),
  metadata: z.record(z.string(), z.string()).optional()
    .refine((data) => !data || Object.keys(data).length <= 4, {
      message: "Metadata can contain at most 4 key-value pairs"
    })
    .describe('Metadata for the file. Supports up to 4 string key-value pairs where both keys and values must be strings'),
  datasetId: z.string().optional()
    .describe('Existing dataset ID to add file to. If not provided, creates new dataset'),
  withCDN: z.boolean().optional()
    .describe('Enable CDN for this file. Default: false. Use for frequently accessed files'),
  autoPayment: z.boolean().optional().default(true)
    .describe('Automatically process payment if insufficient balance. Default: true'),
});

// Balance query schema
export const GetBalancesSchema = z.object({
  storageCapacityBytes: z.number().optional().default(env.TOTAL_STORAGE_NEEDED_GiB * Number(SIZE_CONSTANTS.GiB))
    .describe('Storage capacity in bytes. Default: 1 TB. This is used to calculate the storage needs and the deposit needed.'),
  persistencePeriodDays: z.number().optional().default(env.PERSISTENCE_PERIOD_DAYS)
    .describe('Persistence period in days. Default: 365. This is used to calculate the storage needs and the deposit needed.'),
  notificationThresholdDays: z.number().optional().default(env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS)
    .describe('Notification threshold in days. Default: 10. This is used check if the user needs to top up their storage balance before the storage balance runs out.'),
});

// Payment processing schema
export const ProcessPaymentSchema = z.object({
  depositAmount: z.number().optional().default(0)
    .describe('Amount to deposit in USDFC. Default: 0. If not provided, the tool will check the balance and deposit the necessary amount.')
});

export const ProcessWithdrawalSchema = z.object({
  withdrawalAmount: z.number().optional().default(0)
    .describe('Amount to withdraw in USDFC. Default: 0. If not provided, the tool will check the balance and withdraw the necessary amount.')
});

// Provider query schema
export const GetProvidersSchema = z.object({
  onlyApproved: z.boolean().optional().default(true)
    .describe('Filter to only approved providers. Default: true'),
});

/**
 * Output schemas for FOC Storage tool responses
 * Zod validation schemas for tool return values
 */

// Common response schemas
export const BaseErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
});

// Nested schemas for complex objects
export const UnifiedSizeInfoSchema = z.object({
  sizeBytes: z.string(),
  sizeKiB: z.number(),
  sizeMiB: z.number(),
  sizeGiB: z.number(),
  withCDN: z.boolean().optional(),
  leafCount: z.number().optional(),
  pieceCount: z.number().optional(),
  message: z.string().optional(),
});

export const DataSetPieceSchema = z.object({
  pieceCid: z.string(),
  retrievalUrl: z.string(),
  sizes: UnifiedSizeInfoSchema,
  metadata: z.record(z.string(), z.string()),
});

export const DataSetSchema = z.object({
  datasetId: z.number(),
  withCDN: z.boolean(),
  datasetMetadata: z.record(z.string(), z.string()),
  totalDatasetSizeMessage: z.string(),
  dataSetPieces: z.array(DataSetPieceSchema),
});

export const StorageBalanceResultSchema = z.object({
  filBalance: z.bigint(),
  usdfcBalance: z.bigint(),
  availableStorageFundsUsdfc: z.bigint(),
  depositNeeded: z.bigint(),
  availableToFreeUp: z.bigint(),
  daysLeftAtMaxBurnRate: z.number(),
  daysLeftAtBurnRate: z.number(),
  isRateSufficient: z.boolean(),
  isLockupSufficient: z.boolean(),
  isSufficient: z.boolean(),
  currentStorageMonthlyRate: z.bigint(),
  maxStorageMonthlyRate: z.bigint(),
});

// Serialized version with string values for JSON output
export const StorageBalanceResultSerializedSchema = z.object({
  filBalance: z.string(),
  usdfcBalance: z.string(),
  availableStorageFundsUsdfc: z.string(),
  depositNeeded: z.string(),
  availableToFreeUp: z.string(),
  daysLeftAtMaxBurnRate: z.number(),
  daysLeftAtBurnRate: z.number(),
  isRateSufficient: z.boolean(),
  isLockupSufficient: z.boolean(),
  isSufficient: z.boolean(),
  currentStorageMonthlyRate: z.string(),
  maxStorageMonthlyRate: z.string(),
});

export const FormattedStorageBalanceResultSchema = z.object({
  filBalance: z.string(),
  usdfcBalance: z.string(),
  availableStorageFundsUsdfc: z.string(),
  currentStorageMonthlyRate: z.string(),
  maxStorageMonthlyRate: z.string(),
  daysLeftAtMaxBurnRate: z.string(),
  daysLeftAtBurnRate: z.string(),
  depositNeeded: z.string(),
  availableToFreeUp: z.string(),
  isRateSufficient: z.boolean(),
  isLockupSufficient: z.boolean(),
  isSufficient: z.boolean(),
});

// Provider tool output schemas
// MCP requires output schema to be a plain object (not union/oneOf)
// Merge success and error cases into single schema with optional fields
export const GetProvidersOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  providers: z.array(z.custom<PDPProvider>()),
  count: z.number().optional(),
  // Error fields  
  error: z.string().optional(),
  // Common field
  message: z.string(),
});

// File tool output schemas
// MCP requires output schema to be a plain object (not union/oneOf)
export const UploadFileOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  taskId: z.string().optional(),
  pieceCid: z.string().optional(),
  retrievalUrl: z.string().optional(),
  txHash: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  progressLog: z.array(z.string()).optional(),
  // Error fields
  error: z.string().optional(),
  // Common field
  message: z.string(),
});

// Payment tool output schemas
// MCP requires output schema to be a plain object (not union/oneOf)
export const ProcessPaymentOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  txHash: z.string().nullable().optional(),
  required: z.object({
    deposit: z.number(),
  }).optional(),
  available: z.number().optional(),
  progressLog: z.array(z.string()).optional(),
  // Error fields
  error: z.string().optional(),
});

// Payment tool output schemas
// MCP requires output schema to be a plain object (not union/oneOf)
export const ProcessWithdrawalOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  txHash: z.string().nullable().optional(),
  progressLog: z.array(z.string()).optional(),
  // Error fields
  error: z.string().optional(),
});

// Balance tool output schemas
// MCP requires output schema to be a plain object (not union/oneOf)
export const GetBalancesOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  checkStorageBalanceResultFormatted: FormattedStorageBalanceResultSchema.optional(),
  checkStorageBalanceResult: StorageBalanceResultSerializedSchema.optional(),
  progressLog: z.array(z.string()).optional(),
  // Error fields
  error: z.string().optional(),
  message: z.string().optional(),
});

// Dataset tool output schemas
// MCP requires output schema to be a plain object (not union/oneOf)
export const GetDatasetsOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  datasets: z.array(z.custom<DataSetWithPieces>()).optional(),
  count: z.number().optional(),
  progressLog: z.array(z.string()).optional(),
  // Error fields
  error: z.string().optional(),
  // Common field
  message: z.string(),
});

export const GetDatasetOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  dataset: z.custom<DataSetWithPieces>().optional(),
  // Error fields
  error: z.string().optional(),
  // Common field
  message: z.string(),
});

// MCP requires output schema to be a plain object (not union/oneOf)
export const CreateDatasetOutputSchema = z.object({
  success: z.boolean(),
  // Success fields
  datasetId: z.string().nullable().optional(),
  txHash: z.string().nullable().optional(),
  progressLog: z.array(z.string()).optional(),
  // Error fields
  error: z.string().nullable().optional(),
  // Common field
  message: z.string(),
});
