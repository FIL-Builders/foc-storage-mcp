import { createTool } from "@mastra/core";
import {
  GetDatasetsSchema,
  CreateDatasetSchema,
  GetDatasetsOutputSchema,
  CreateDatasetOutputSchema,
  GetDatasetSchema,
  GetDatasetOutputSchema,
  SIZE_CONSTANTS,
} from "@/types";
import { getSynapseInstance, createErrorResponse, serializeBigInt } from "@/lib";
import { getDatasets as getDatasetsUtils, processStoragePayment } from "@/services";
import { env } from "@/config";

/**
 * Dataset tools for FOC storage operations.
 */

export const getDatasets = createTool({
  id: "getDatasets",
  description:
    "Retrieve all datasets owned by the connected wallet with comprehensive information including piece CIDs, file sizes, provider details, and retrieval URLs. Filter by CDN status or view all datasets. Each dataset contains complete metadata about stored files and their blockchain storage proofs. Use this to inventory files, check storage status, or locate specific uploads.",
  inputSchema: GetDatasetsSchema,
  outputSchema: GetDatasetsOutputSchema,
  execute: async ({ context }) => {
    const withCDN = context.filterByCDN ?? false;
    const includeAll = context.includeAllDatasets ?? false;
    return await getDatasetsUtils(withCDN, includeAll);
  },
});

export const getDataset = createTool({
  id: "getDataset",
  description:
    "Retrieve detailed information about a specific dataset by its ID, including all pieces (files), their CIDs, sizes, retrieval URLs, and metadata. Returns the same comprehensive data structure as getDatasets but for a single dataset. Use this when you know the dataset ID and need detailed information about its contents.",
  inputSchema: GetDatasetSchema,
  outputSchema: GetDatasetOutputSchema,
  execute: async ({ context }) => {
    try {
      const dataset = await getDatasetsUtils(undefined, undefined, Number(context.datasetId));
      return {
        success: dataset.success,
        dataset: serializeBigInt(dataset.datasets[0]),
        message: dataset.message,
      };
    } catch (error) {
      return createErrorResponse(
        "dataset_fetch_failed",
        `Failed to fetch dataset: ${(error as Error).message}`,
        { success: false }
      ) as any;
    }
  },
});

export const createDataset = createTool({
  id: "createDataset",
  description:
    "Create a new dataset container on Filecoin for organizing related files with consistent storage settings. Datasets define storage parameters (CDN enabled/disabled, provider selection) that apply to all files added to them. Creating datasets upfront allows for better file organization and consistent retrieval performance. Optionally specify a provider or let the system auto-select the optimal one. Note: Payment is processed automatically for CDN-enabled datasets.",
  inputSchema: CreateDatasetSchema,
  outputSchema: CreateDatasetOutputSchema,
  execute: async ({ context }) => {
    try {
      const synapse = await getSynapseInstance();

      // const withCDN = context.withCDN ?? false;
      const withCDN = true;

      if (withCDN) {
        // Process payment
        const paymentResult = await processStoragePayment(synapse, BigInt(env.TOTAL_STORAGE_NEEDED_GiB * Number(SIZE_CONSTANTS.GiB)), env.PERSISTENCE_PERIOD_DAYS);
        if (!paymentResult.success) {
          return createErrorResponse(
            "payment_failed",
            `Failed to process payment: ${paymentResult.txHash ?? "Unknown error"}`,
            { success: false }
          ) as any;
        }
      }

      let datasetId: string | undefined;
      let txHash: string | undefined;

      // Create storage with forceCreateDataSet
      await synapse.createStorage({
        providerId: context.providerId
          ? parseInt(context.providerId)
          : undefined,
        forceCreateDataSet: true,
        metadata: context.metadata,
        callbacks: {
          onDataSetCreationStarted: (txResponse) => {
            txHash = txResponse.hash;
            console.log(`[Dataset] Creation started (tx: ${txResponse.hash})`);
          },
          onDataSetCreationProgress: (status) => {
            if (status.serverConfirmed) {
              datasetId = status.dataSetId?.toString() || undefined;
              console.log(`[Dataset] Ready (ID: ${status.dataSetId?.toString()})`);
            }
          },
        },
      });

      return {
        success: true as const,
        datasetId,
        txHash,
        message: "Dataset created successfully",
      };
    } catch (error) {
      return createErrorResponse(
        "dataset_creation_failed",
        `Failed to create dataset: ${(error as Error).message}`,
        { success: false }
      ) as any;
    }
  },
});

// Export all dataset tools
export const datasetTools = {
  getDataset,
  getDatasets,
  createDataset,
};
