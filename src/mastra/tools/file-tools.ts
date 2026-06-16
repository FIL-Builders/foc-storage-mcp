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
  getExplorerUrl,
} from "@/lib";
import { checkStorageBalance } from "@/services";
import { processPaymentService } from "@/services/payment-service";
import { getProvider } from "@/services";
import { selectHealthyProviders } from "@/services";

/**
 * File tools for FOC storage operations.
 */
const uploadFile = createTool({
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
      const dataSetId = context.datasetId ? BigInt(context.datasetId) : undefined;
      const isExistingDataset = dataSetId !== undefined;
      const storageMetrics = await checkStorageBalance(
        fileInfo.size,
        env.PERSISTENCE_PERIOD_DAYS,
        {
          upload: {
            isNewDataSet: !isExistingDataset,
            dataSetId,
            withCDN: context.withCDN || false,
          },
        },
      );

      // PHASE 5: Auto-payment if needed
      if (!storageMetrics.isSufficient) {
        if (!context.autoPayment) {
          return {
            success: false,
            error: "insufficient_balance",
            message:
              `Insufficient balance: ${fromBaseUnits(storageMetrics.depositNeeded, 18)} USDFC required. Enable autoPayment parameter or use processPayment tool to deposit funds first.`,
          };
        }

        log(storageMetrics.depositNeeded > 0n
          ? "Insufficient balance, processing payment..."
          : "Insufficient service approvals, approving service...");
        log(`Deposit needed: ${fromBaseUnits(storageMetrics.depositNeeded, 18)} USDFC`);

        if (storageMetrics.depositNeeded > 0n || !storageMetrics.isSufficient) {

          const { success } = await processPaymentService(BigInt(storageMetrics.depositNeeded));
          if (!success) {
            return createErrorResponse(
              "payment_failed",
              "Failed to process payment",
              { success: false }
            );
          }

          log("Payment processed successfully");
        }
      }

      // PHASE 6: Storage service creation
      log("Creating storage service...");

      // For a NEW dataset, pick a reachable provider ourselves and pass it
      // explicitly so the SDK resolves it directly instead of running
      // smartSelect, whose 1s ping wrongly rejects healthy-but-slow providers.
      // For an existing dataset the provider is fixed by the dataset.
      let providerId: bigint | undefined;
      if (!isExistingDataset) {
        const selection = await selectHealthyProviders(1);
        providerId = selection.providerIds[0];
        log(
          `Selected provider ${selection.primaryName} (${selection.reachableCount}/${selection.approvedCount} providers reachable)`,
        );
        if (selection.usedUnendorsedPrimary) {
          log("No endorsed provider reachable; using a reachable approved provider.");
        }
      }

      const storageService = await synapse.storage.createContext({
        dataSetId,
        providerId,
        withCDN: context.withCDN || false,
        callbacks: {
          onDataSetResolved: (info) => {
            log(`Dataset ${info.dataSetId} resolved`);
            log(`Dataset provider: ${info.provider.id.toString()}`);
            log(`Is existing dataset: ${isExistingDataset}`);
          },
          onProviderSelected: (provider) => {
            log(`Provider selected: ${provider.id.toString()}`);
          },
        },
      });

      // PHASE 7: File upload
      log("Uploading file to provider...");
      let uploadTxHash: string | undefined;

      const uploadResult = await storageService.upload(uint8ArrayBytes, {
        pieceMetadata: context.metadata,
        onStored: (_providerId, piece) => {
          log(`Upload stored (pieceCid: ${piece.toV1().toString()})`);
        },
        onPiecesAdded: (transaction) => {
          uploadTxHash = transaction;
          log(`Piece added to dataset (tx: ${transaction || "pending"})`);
        },
        onPiecesConfirmed: () => {
          log("Piece confirmed on blockchain");
        },
      });

      const { pieceCid } = uploadResult;
      const provider = await getProvider(storageService.provider.id);

      const getRetrievalUrl = async (pieceCidString: string) => {
        if (context.withCDN) {
          const network = env.FILECOIN_NETWORK === 'mainnet' ? 'mainnet' : 'calibration';
          return `https://${synapse.client.account.address}.${network}.filbeam.io/${pieceCidString}`;
        } else {
          const serviceURL = provider.pdp.serviceURL;
          const endsWithSlash = serviceURL.endsWith('/');
          const serviceURLWithoutSlash = endsWithSlash ? serviceURL.slice(0, -1) : serviceURL;
          return `${serviceURLWithoutSlash}/piece/${pieceCidString}`;
        }
      };

      const retrievalUrl = await getRetrievalUrl(pieceCid.toV1().toString());
      console.log(`Upload successful! Retrieval URL: ${retrievalUrl}`);
      console.log(`Piece CID: ${pieceCid.toV1().toString()}`);
      console.log(`TX Hash: ${uploadTxHash}`);
      console.log(`File Name: ${fileName}`);
      console.log(`File Size: ${fileInfo.size}`);

      if (uploadTxHash) {
        log(`View transaction: ${getExplorerUrl(uploadTxHash)}`);
      }

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
