/**
 * Tool response interfaces for FOC Storage operations
 * Standardized response types for all tool operations
 */

import { ProviderInfo } from '@filoz/synapse-sdk';
import { DataSet } from '@/types';

export interface ToolResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface DatasetResponse extends ToolResponse {
  datasets?: DataSet[];
  count?: number;
}

export interface UploadResponse extends ToolResponse {
  pieceCid?: string;
  txHash?: string;
  datasetId?: string;
  fileName?: string;
  fileSize?: number;
  progress?: number;
  status?: string;
  progressLog?: string[];
}

export interface CreateDatasetResponse extends ToolResponse {
  datasetId?: string;
  txHash?: string;
}

export interface PaymentResponse extends ToolResponse {
  txHash?: string;
  depositAmount?: string;
  rateAllowance?: string;
  lockupAllowance?: string;
}

export interface ProviderResponse extends ToolResponse {
  providers?: ProviderInfo[];
  count?: number;
}
