import { PDPProvider } from "@filoz/synapse-core/sp-registry";
import { account, client, publicClient } from "./viem";
import {
  getPdpDataSet,
  getPdpDataSets,
  type PdpDataSet,
} from "@filoz/synapse-core/warm-storage";
import { getPiecesWithMetadata } from "@filoz/synapse-core/pdp-verifier";
import { createDataSet, waitForCreateDataSet } from "@filoz/synapse-core/sp";
import type { MetadataObject } from "@filoz/synapse-core/utils";
import { synapseErrorHandler } from "@/lib/errors";

export interface DatasetPiece {
  id: bigint;
  url: string;
  metadata: MetadataObject;
  cid: string;
}

export type DatasetWithPieces = PdpDataSet & { pieces: DatasetPiece[] };

const fetchDatasetPieces = async (dataset: PdpDataSet): Promise<DatasetPiece[]> => {
  const { pieces } = await getPiecesWithMetadata(publicClient, {
    dataSet: dataset,
    address: account.address,
  });
  return pieces.map((piece) => ({
    id: piece.id,
    url: piece.url,
    metadata: piece.metadata,
    cid: piece.cid.toString(),
  }));
};

/**
 * Retrieves all datasets owned by the account with their pieces and metadata
 * @param withCDN Filter to only CDN-enabled datasets
 * @param includeAll Include all datasets regardless of CDN status
 * @returns Array of datasets with pieces and metadata
 */
export const getDatasetsService = async (
  withCDN: boolean = false,
  includeAll: boolean = false,
) => {
  const dataSets = (
    await getPdpDataSets(publicClient, {
      address: account.address,
    })
  ).filter((dataset: PdpDataSet) => includeAll || (withCDN && dataset.cdn));

  return Promise.all(
    dataSets.map(async (dataset: PdpDataSet) => ({
      ...dataset,
      pieces: await fetchDatasetPieces(dataset),
    })),
  );
};

/**
 * Retrieves a single dataset by ID with its pieces and metadata
 * @param datasetId Dataset identifier
 * @returns Dataset with pieces and metadata
 */
export const getDataSetService = async (datasetId: number) => {
  const dataset = await getPdpDataSet(publicClient, {
    dataSetId: BigInt(datasetId),
  });
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }
  return {
    ...dataset,
    pieces: await fetchDatasetPieces(dataset),
  };
};

/**
 * Creates a new dataset on the blockchain
 * @param provider Storage provider to use
 * @param cdn Enable CDN for the dataset
 * @param metadata Key-value metadata for the dataset (max 10 pairs)
 * @returns Creation result with dataset ID and transaction hash
 */
export const createDataSetService = async (
  provider: PDPProvider,
  cdn: boolean,
  metadata: Record<string, string>,
) => {
  try {
    const created = await createDataSet(client, {
      cdn,
      payee: provider.payee,
      serviceURL: provider.pdp.serviceURL,
      metadata,
    });
    const { dataSetId } = await waitForCreateDataSet({
      statusUrl: created.statusUrl,
    });

    return {
      success: true,
      dataSetId: dataSetId.toString(),
      txHash: created.txHash,
      message: "Dataset created successfully",
    };
  } catch (error) {
    return {
      success: false,
      txHash: null,
      dataSetId: null,
      message: "Failed to create dataset: " + synapseErrorHandler(error),
    };
  }
};
