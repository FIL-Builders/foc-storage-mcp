import { createTool } from "@mastra/core";
import {
  GetDatasetsSchema,
  CreateDatasetSchema,
  GetDatasetsOutputSchema,
  CreateDatasetOutputSchema,
  GetDatasetSchema,
  GetDatasetOutputSchema,
} from "@/types";
import { createErrorResponse, serializeBigInt, getExplorerUrl } from "@/lib";

import { env } from "@/config";

import { getDatasetsService, getDataSetService, createDataSetService } from "@/services/dataset-service";
import { getProvider as getProviderService } from "@/services";
import { processPaymentService } from "@/services/payment-service";

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
    const progressLog: string[] = [];
    const log = (msg: string) => { progressLog.push(msg); };

    try {
      const withCDN = context.filterByCDN ?? false;
      const includeAll = context.includeAllDatasets ?? false;

      log("Fetching datasets from blockchain...");
      const dataSets = await getDatasetsService(withCDN, includeAll);

      if (dataSets.length > 0) {
        log(`Retrieved ${dataSets.length} dataset(s)`);
        log("Processing dataset metadata...");
      }

      return {
        success: true,
        datasets: dataSets.map((dataset) => serializeBigInt(dataset)),
        count: dataSets.length,
        message: `Found ${dataSets.length} dataset(s)`,
        progressLog,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        message: `Failed to fetch datasets: ${(error as Error).message}`,
        progressLog,
      };
    }
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
      const dataset = await getDataSetService(Number(context.datasetId));
      return {
        success: true,
        dataset: serializeBigInt(dataset),
        message: "Dataset fetched successfully",
      };
    } catch (error) {
      return createErrorResponse(
        "dataset_fetch_failed",
        `Failed to fetch dataset: ${(error as Error).message}`,
        { success: false }
      );
    }
  },
});

export const createDataset = createTool({
  id: "createDataset",
  description:
    "Create a new dataset container on Filecoin for organizing related files with consistent storage settings. Datasets define storage parameters (CDN enabled/disabled, provider selection) that apply to all files added to them. Creating datasets upfront allows for better file organization and consistent retrieval performance. Provider ID is required - use getProviders to list available providers. Payment (1 USDFC) is processed automatically for CDN-enabled datasets. Returns dataset ID, transaction hash, and progress tracking through validation, payment, and creation steps.",
  inputSchema: CreateDatasetSchema,
  outputSchema: CreateDatasetOutputSchema,
  execute: async ({ context }) => {
    const progressLog: string[] = [];
    const log = (msg: string) => { progressLog.push(msg); };

    if (!context.providerId) {
      return {
        success: false,
        error: "provider_id_required",
        message: "Provider ID is required. Use getProviders tool to list available providers and select one by ID.",
        progressLog,
      };
    }

    log("Validating provider ID...");
    const provider = await getProviderService(Number(context.providerId));
    log(`Provider validated (ID: ${context.providerId})`);

    const withCDN = context.withCDN ?? false;

    if (withCDN) {
      log("Processing CDN payment (1 USDFC)...");
      const { success, error } = await processPaymentService(BigInt(env.CDN_DATASET_FEE));
      if (!success) {
        return {
          success: false,
          error: "payment_failed",
          message: `Failed to process CDN payment (1 USDFC required): ${error}. Use processPayment tool to add funds first.`,
          progressLog,
        };
      }
      log("CDN payment processed successfully");
    }

    log("Creating dataset on blockchain...");
    const result = await createDataSetService(provider, withCDN, context.metadata ?? {});

    if (result.success) {
      log("Dataset created successfully");
      if (result.txHash) {
        log(`View transaction: ${getExplorerUrl(result.txHash)}`);
      }
      return {
        ...result,
        progressLog,
      };
    }

    return {
      ...result,
      progressLog,
    };
  },
});

export const datasetTools = {
  getDataset,
  getDatasets,
  createDataset,
};

