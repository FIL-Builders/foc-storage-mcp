/**
 * Core data structures and type definitions for FOC Storage
 * SDK types, interfaces, and data models
 */


/**
 * Unified size interface that consolidates storage size calculations
 * Standardizes on consistent naming patterns and supports both dataset and piece contexts
 * All calculations use GiB (1024^3) for internal consistency, GB (1000^3) for user display
 */
export interface UnifiedSizeInfo {
  /** Size in bytes - primary measurement */
  sizeBytes: bigint;
  /** Size in KiB (1024 bytes) */
  sizeKiB: number;
  /** Size in MiB (1024^2 bytes) */
  sizeMiB: number;
  /** Size in GiB (1024^3 bytes) - standardized for calculations */
  sizeGiB: number;
  /** Whether CDN storage is enabled for this item */
  withCDN?: boolean;
  /** Number of merkle tree leaves */
  leafCount?: number;
  /** Number of pieces */
  pieceCount?: number;
  /** User-friendly size message */
  message?: string;
}

export interface DataSetPiece {
  pieceCid: string;
  retrievalUrl: string;
  sizes: UnifiedSizeInfo;
  metadata: Record<string, string>;
}

export interface DataSet {
  datasetId: number;
  withCDN: boolean;
  datasetMetadata: Record<string, string>;
  totalDatasetSizeMessage: string;
  serviceURL: string;
  dataSetPieces: DataSetPiece[];
}

export interface DatasetsResponse {
  datasets: DataSet[];
}