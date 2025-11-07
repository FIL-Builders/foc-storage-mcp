/**
 * Tool response interfaces for FOC Storage operations
 * Standardized response types for all tool operations
 */

export interface ToolResponse {
  success: boolean;
  error?: string;
  message?: string;
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

export interface PaymentResponse extends ToolResponse {
  txHash?: string;
  depositAmount?: string;
  rateAllowance?: string;
  lockupAllowance?: string;
}