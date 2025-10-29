import { DataSetPieceData, EnhancedDataSetInfo, PDPServer, WarmStorageService } from "@filoz/synapse-sdk";
import { DataSet, UnifiedSizeInfo } from "@/types";
import { getPieceInfoFromCidBytes, sizeInfoMessage, serializeBigInt } from "@/lib";
import { getSynapseInstance, createErrorResponse } from "@/lib";

export const getDatasets = async (withCDN: boolean = false, includeAll: boolean = false, onlyDatasetId: number | undefined = undefined) => {
    try {
        const synapse = await getSynapseInstance();

        const warmStorageAddress = synapse.getWarmStorageAddress();

        const warmStorageService = await WarmStorageService.create(synapse.getProvider(), warmStorageAddress);

        // Fetch datasets from blockchain
        const datasets = await synapse.storage.findDataSets();

        if (datasets.length === 0) {
            return {
                success: true,
                datasets: [],
                count: 0,
                message:
                    "No datasets found. Upload files to create your first dataset.",
            };
        }

        // Fetch provider info in parallel
        const providers = await Promise.all(
            datasets.map((dataset: any) =>
                synapse.getProviderInfo(dataset.providerId).catch(() => null)
            )
        );

        const userAddress = await synapse.getSigner().getAddress();

        // Apply filters: onlyDatasetId takes priority, then includeAll or CDN filter
        const filteredDatasets = datasets.filter((dataset: EnhancedDataSetInfo) => {
            // If onlyDatasetId is specified, only return that dataset
            if (onlyDatasetId !== undefined) {
                return dataset.pdpVerifierDataSetId === onlyDatasetId;
            }
            // If includeAll is true, return all datasets
            if (includeAll) {
                return true;
            }
            // Otherwise filter by CDN status
            return dataset.withCDN === withCDN;
        });

        if (filteredDatasets.length === 0) {
            return {
                success: true,
                datasets: [],
                count: 0,
                message: `No datasets found with the given criteria`,
            };
        }

        const enrichedDatasets = await Promise.all(
            filteredDatasets.map(async (dataset: EnhancedDataSetInfo) => {
                const provider = providers.find((p) => p?.id === dataset.providerId)!
                const serviceURL = provider.products.PDP?.data.serviceURL || "";

                try {
                    // STEP 6: Connect to PDP server to get piece information
                    const pdpServer = new PDPServer(null, serviceURL);
                    const data = await pdpServer
                        .getDataSet(dataset.pdpVerifierDataSetId)
                        .then((data) => {
                            // Reverse to show most recent uploads first in UI
                            data.pieces.reverse();
                            return data;
                        });

                    // STEP 7: Create pieces map
                    const pieces = data.pieces.reduce(
                        (acc, piece: DataSetPieceData) => {
                            acc[piece.pieceCid.toV1().toString()] =
                                getPieceInfoFromCidBytes(piece.pieceCid);
                            return acc;
                        },
                        {} as Record<string, UnifiedSizeInfo>
                    );

                    const piecesMetadata = (await Promise.all(data.pieces.map(async (piece: DataSetPieceData) => {
                        return { pieceId: piece.pieceId, metadata: await warmStorageService.getPieceMetadata(dataset.pdpVerifierDataSetId, piece.pieceId) };
                    }))).reduce((acc, piece) => {
                        acc[piece.pieceId] = piece.metadata;
                        return acc;
                    }, {} as Record<number, Record<string, string>>);

                    const getRetrievalUrl = (pieceCid: string) => {
                        if (dataset.withCDN) {
                            return `https://${userAddress}.calibration.filbeam.io/${pieceCid}`;
                        } else {
                            const endsWithSlash = serviceURL.endsWith('/');
                            const serviceURLWithoutSlash = endsWithSlash ? serviceURL.slice(0, -1) : serviceURL;
                            return `${serviceURLWithoutSlash}/piece/${pieceCid}`;
                        }
                    };

                    const datasetSizeInfo = data.pieces.reduce((acc, piece: DataSetPieceData) => {
                        acc.sizeInBytes += Number(pieces[piece.pieceCid.toV1().toString()].sizeBytes);
                        acc.sizeInKiB += Number(pieces[piece.pieceCid.toV1().toString()].sizeKiB);
                        acc.sizeInMiB += Number(pieces[piece.pieceCid.toV1().toString()].sizeMiB);
                        acc.sizeInGB += Number(pieces[piece.pieceCid.toV1().toString()].sizeGiB);
                        return acc;
                    }, { sizeInBytes: 0, sizeInKiB: 0, sizeInMiB: 0, sizeInGB: 0, message: "" });

                    const dataSetPieces = data.pieces.map((piece: DataSetPieceData) => ({
                        pieceCid: piece.pieceCid.toV1().toString(),
                        retrievalUrl: getRetrievalUrl(piece.pieceCid.toV1().toString()),
                        sizes: pieces[piece.pieceCid.toV1().toString()],
                        metadata: piecesMetadata[piece.pieceId],
                    }));

                    return {
                        datasetId: dataset.pdpVerifierDataSetId,
                        withCDN: dataset.withCDN,
                        datasetMetadata: dataset.metadata,
                        totalDatasetSizeMessage: sizeInfoMessage(datasetSizeInfo),
                        dataSetPieces: dataSetPieces,
                    } as DataSet;
                } catch (error) {
                    // console.warn(
                    //     `Failed to fetch dataset details for ${dataset.pdpVerifierDataSetId}:`,
                    //     error
                    // );
                    // Return dataset without detailed data but preserve basic info
                    return null;
                }
            })
        );

        return {
            success: true,
            datasets: enrichedDatasets.filter((dataset) => dataset !== null).map(serializeBigInt) as DataSet[],
            count: enrichedDatasets.length,
            message: `Found ${enrichedDatasets.length} dataset(s)`,
        };
    } catch (error) {
        return createErrorResponse(
            "dataset_fetch_failed",
            `Failed to fetch datasets: ${(error as Error).message}`,
            { success: false }
        ) as any;
    }
}

export const getStorageUsageMetrics = async () => {
    let datasets: DataSet[] = [];
    let res;

    try {
        res = await getDatasets();
        if (res.success === false) {
            return res;
        }
        datasets = res.datasets;
    } catch (error) {
        return createErrorResponse(
            "dataset_fetch_failed",
            `Failed to fetch datasets: ${(error as Error).message}`,
            { success: false }
        );
    }

    const cdnDatasets = datasets.filter((dataset) => dataset.withCDN);
    const nonCdnDatasets = datasets.filter((dataset) => !dataset.withCDN);

    const cdnUsedGiB = cdnDatasets.reduce((acc, dataset) => {
        return acc + dataset.dataSetPieces.reduce((acc, piece) => {
            return acc + piece.sizes.sizeGiB;
        }, 0);
    }, 0);

    const nonCdnUsedGiB = nonCdnDatasets.reduce((acc, dataset) => {
        return acc + dataset.dataSetPieces.reduce((acc, piece) => {
            return acc + piece.sizes.sizeGiB;
        }, 0);
    }, 0);

    const totalUsedGiB = cdnUsedGiB + nonCdnUsedGiB;

    return {
        success: true,
        message: `Found ${cdnDatasets.length} CDN dataset(s) with ${cdnUsedGiB.toFixed(5)} GiB used and ${nonCdnDatasets.length} non-CDN dataset(s) with ${nonCdnUsedGiB.toFixed(5)} GiB used with a total of ${totalUsedGiB.toFixed(5)} GiB used out of ${datasets.length} datasets`,
    };
}
