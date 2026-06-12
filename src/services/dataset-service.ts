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
import { serializeBigInt } from "@/lib/serialize";
import type { JsonValue, McpDataset, McpDatasetPiece } from "@/types";

const fetchDatasetPieces = async (dataset: PdpDataSet): Promise<McpDatasetPiece[]> => {
  const { pieces } = await getPiecesWithMetadata(publicClient, {
    dataSet: dataset,
    address: account.address,
  });
  return pieces.map((piece) => ({
    id: piece.id.toString(),
    url: piece.url,
    metadata: serializeBigInt(piece.metadata) as Record<string, JsonValue>,
    cid: piece.cid.toString(),
  }));
};

export const toMcpDataset = (
  dataset: PdpDataSet,
  pieces: McpDatasetPiece[],
): McpDataset => serializeBigInt({
  ...dataset,
  pieces,
}) as unknown as McpDataset;

/**
 * Retrieves all datasets owned by the account with their pieces and metadata
 * @param withCDN Filter to only CDN-enabled datasets
 * @param includeAll Include all datasets regardless of CDN status
 * @returns Array of datasets with pieces and metadata
 */
export const getDatasetsService = async (
  withCDN: boolean = false,
  includeAll: boolean = false,
) : Promise<McpDataset[]> => {
  const dataSets = (
    await getPdpDataSets(publicClient, {
      address: account.address,
    })
  ).filter((dataset: PdpDataSet) => includeAll || (withCDN && dataset.cdn));

  return Promise.all(
    dataSets.map(async (dataset: PdpDataSet) =>
      toMcpDataset(dataset, await fetchDatasetPieces(dataset)),
    ),
  );
};

/**
 * Retrieves a single dataset by ID with its pieces and metadata
 * @param datasetId Dataset identifier
 * @returns Dataset with pieces and metadata
 */
export const getDataSetService = async (datasetId: number): Promise<McpDataset> => {
  const dataset = await getPdpDataSet(publicClient, {
    dataSetId: BigInt(datasetId),
  });
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }
  return toMcpDataset(dataset, await fetchDatasetPieces(dataset));
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
