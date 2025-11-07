import { metadataArrayToObject } from "@filoz/synapse-core/utils";
import { PDPProvider } from "@filoz/synapse-core/warm-storage";
import { account, client, publicClient } from "./viem";
import { createDataSet, getDataSet, getDataSets, getPieces, Piece } from "@filoz/synapse-core/warm-storage";
import * as SP from "@filoz/synapse-core/sp";
import { CONTRACTS } from "@/config";
import { readContract } from 'viem/actions'
import { synapseErrorHandler } from "@/lib/errors";


const getPiecesWithMetadata = async (dataSetId: bigint, pieces: Piece[]) => {
    return await Promise.all(
        pieces.map(async (piece) => {
            const metadata = await readContract(client, {
                address: CONTRACTS.storageView.address,
                abi: CONTRACTS.storageView.abi,
                functionName: 'getAllPieceMetadata',
                args: [dataSetId, BigInt(piece.id)],
            })
            return {
                ...piece,
                metadata: metadataArrayToObject(metadata),
            }
        })
    )
}

/**
 * Retrieves all datasets owned by the account with their pieces and metadata
 * @param withCDN Filter to only CDN-enabled datasets
 * @param includeAll Include all datasets regardless of CDN status
 * @returns Array of datasets with pieces and metadata
 */
export const getDatasetsService = async (withCDN: boolean = false, includeAll: boolean = false) => {
    const dataSets = (await getDataSets(publicClient, {
        address: account.address,
    }))
        .filter((dataset) => includeAll || (withCDN && dataset.cdn));

    const datasetsWithPieces = await Promise.all(dataSets.map(async (dataset) => {
        const pieces = await getPieces(publicClient, {
            address: account.address,
            dataSet: dataset,
        });
        return {
            ...dataset,
            pieces: await getPiecesWithMetadata(dataset.dataSetId, pieces.pieces),
        };
    }));

    return datasetsWithPieces;
}

/**
 * Retrieves a single dataset by ID with its pieces and metadata
 * @param datasetId Dataset identifier
 * @returns Dataset with pieces and metadata
 */
export const getDataSetService = async (datasetId: number) => {
    const dataset = await getDataSet(publicClient, {
        dataSetId: BigInt(datasetId),
    });
    const pieces = await getPieces(publicClient, {
        address: account.address,
        dataSet: dataset,
    });
    return {
        ...dataset,
        pieces: await getPiecesWithMetadata(dataset.dataSetId, pieces.pieces),
    };
}


/**
 * Creates a new dataset on the blockchain
 * @param provider Storage provider to use
 * @param cdn Enable CDN for the dataset
 * @param metadata Key-value metadata for the dataset (max 10 pairs)
 * @returns Creation result with dataset ID and transaction hash
 */
export const createDataSetService = async (provider: PDPProvider, cdn: boolean, metadata: Record<string, string>) => {
    try {
        const dataset = await createDataSet(client, {
            cdn: cdn,
            payee: provider.payee,
            endpoint: provider.pdp.serviceURL,
            metadata: metadata,
        });
        const { dataSetId } = await SP.pollForDataSetCreationStatus({ statusUrl: dataset.statusUrl });

        return {
            success: true,
            dataSetId: dataSetId.toString(),
            txHash: dataset.txHash,
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
}