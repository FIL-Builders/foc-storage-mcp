import { createTool } from "@mastra/core";
import { promises as fs } from "fs";
import { basename } from "path";
import {
  UploadFileSchema,
  UploadFileOutputSchema,
} from "@/types";
import { env } from "@/config";
import {
  getSynapseInstance,
  validateFilePath,
  createErrorResponse,
  fromBaseUnits,
} from "@/lib";
import { checkStorageBalance } from "@/services";
import { processStoragePayment } from "@/services";

/**
 * File tools for FOC storage operations.
 */

export const uploadFile = createTool({
  id: "uploadFile",
  description:
    "Upload files to decentralized Filecoin storage with automatic payment handling and progress tracking. Supports both standard storage and CDN-enabled storage for frequently accessed files. The upload process is tracked through 8 phases with detailed progress logging. Prerequisites: Valid file path, PRIVATE_KEY environment variable. Returns pieceCid for retrieval and transaction hash for verification.",
  inputSchema: UploadFileSchema,
  outputSchema: UploadFileOutputSchema,
  execute: async ({ context }) => {
    const progressLog: string[] = [];
    const log = (msg: string) => {
      progressLog.push(msg);
      console.log(`[Upload] ${msg}`);
    };

    try {
      // PHASE 1: File validation
      log("Validating file...");
      const fileInfo = await validateFilePath(context.filePath);
      const fileName = context.fileName || basename(fileInfo.path);

      // PHASE 2: File reading
      log("Reading file...");
      const fileBuffer = await fs.readFile(fileInfo.path);
      const uint8ArrayBytes = new Uint8Array(fileBuffer);

      // PHASE 3: Synapse initialization
      log("Initializing Synapse SDK...");
      const synapse = await getSynapseInstance();

      // PHASE 4: Balance check
      log("Checking storage balance...");
      const storageMetrics = await checkStorageBalance(
        synapse,
        fileInfo.size,
        env.PERSISTENCE_PERIOD_DAYS
      );

      // PHASE 5: Auto-payment if needed
      if (!storageMetrics.isSufficient) {
        if (!context.autoPayment) {
          return {
            success: false,
            error: "insufficient_balance",
            message:
              "Insufficient balance. Enable autoPayment or call processPayment first",
            required: {
              deposit: fromBaseUnits(storageMetrics.depositNeeded, 18),
            },
          } as any;
        }

        log(storageMetrics.depositNeeded > 0n
          ? "Insufficient balance, processing payment..."
          : "Insufficient service approvals, approving service...");

        await processStoragePayment(
          synapse,
          storageMetrics.depositNeeded,
          env.PERSISTENCE_PERIOD_DAYS
        );

        log(storageMetrics.depositNeeded > 0n
          ? "Payment processed successfully"
          : "Service approved successfully");
      }

      // PHASE 6: Storage service creation
      log("Creating storage service...");

      const storageService = await synapse.createStorage({
        dataSetId: context.datasetId ? Number(context.datasetId) : undefined,
        withCDN: context.withCDN || false,
        callbacks: {
          onDataSetResolved: (info) => {
            log(`Dataset ${info.dataSetId} resolved`);
            log(`Dataset provider: ${Number(info.provider.id)}`);
            log(`Is existing dataset: ${info.isExisting}`);

          },
          onDataSetCreationStarted: (txResponse) => {
            log(`Dataset creation started (tx: ${txResponse.hash})`);
          },
          onDataSetCreationProgress: (status) => {
            if (status.serverConfirmed) {
              log(`Dataset ready (ID: ${status.dataSetId})`);
            }
          },
          onProviderSelected: (provider) => {
            log(`Provider selected: ${provider.id}`);
          },
        },
      });

      // PHASE 7: File upload
      log("Uploading file to provider...");
      let uploadTxHash: string | undefined;

      const { pieceCid } = await storageService.upload(uint8ArrayBytes, {
        metadata: context.metadata,
        onUploadComplete: (piece) => {
          log(`Upload complete (pieceCid: ${piece.toV1().toString()})`);
        },
        onPieceAdded: (txResponse) => {
          uploadTxHash = txResponse?.hash;
          log(`Piece added to dataset (tx: ${txResponse?.hash || "pending"})`);
        },
        onPieceConfirmed: () => {
          log("Piece confirmed on blockchain");
        },
      });

      const getRetrievalUrl = async (pieceCid: string) => {
        if (context.withCDN) {
          return `https://${(await synapse.getSigner().getAddress())}.calibration.filbeam.io/${pieceCid}`;
        } else {
          return `${(await storageService.getProviderInfo()).products.PDP?.data.serviceURL || ""}/piece/${pieceCid}`;
        }
      };

      const retrievalUrl = await getRetrievalUrl(pieceCid.toV1().toString());
      console.log(`Upload successful! Retrieval URL: ${retrievalUrl}`);
      console.log(`Piece CID: ${pieceCid.toV1().toString()}`);
      console.log(`TX Hash: ${uploadTxHash}`);
      console.log(`File Name: ${fileName}`);
      console.log(`File Size: ${fileInfo.size}`);

      return {
        success: true,
        pieceCid: pieceCid.toV1().toString(),
        retrievalUrl: retrievalUrl,
        txHash: uploadTxHash,
        fileName,
        fileSize: fileInfo.size,
        progressLog,
        message: "File successfully stored on Filecoin",
      };
    } catch (error) {
      return createErrorResponse(
        "upload_failed",
        `Upload failed: ${(error as Error).message}`,
        {
          success: false,
          progressLog,
        }
      );
    }
  },
});

// Export all file tools
export const fileTools = {
  uploadFile,
};
