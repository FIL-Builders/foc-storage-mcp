import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { focStorageTools } from "@/mastra/tools";
import { UploadResponse } from "@/types";
import { validateFilePath, serializeBigInt } from "@/lib";
import { fromBaseUnits } from "@/lib";
import { env } from "@/config";
import { checkStorageBalance } from "@/services";
import { processPaymentService } from "@/services/payment-service";

// ============================================================================
// E2E FILE UPLOAD WORKFLOW
// ============================================================================
// This workflow orchestrates the complete file upload process:
// 1. Check balance and storage metrics
// 2. Handle payment if insufficient funds
// 3. Upload file to Filecoin (dataset creation handled by upload tool)
// 4. Generate final summary
// ============================================================================

const e2eFileUploadInputSchema = z.object({
  filePath: z.string().describe("Absolute path to the file to upload"),
  datasetId: z.string().regex(/^\d+$/, "Dataset ID must be a non-negative integer string").optional().describe("Existing dataset ID to use"),
  withCDN: z.boolean().optional().describe("Enable CDN for faster retrieval").default(false),
  persistenceDays: z.number().int().positive().optional().describe("Storage duration in days").default(env.PERSISTENCE_PERIOD_DAYS),
  notificationThresholdDays: z.number().int().positive().optional().describe("Notification threshold in days").default(env.RUNOUT_NOTIFICATION_THRESHOLD_DAYS),
  fileMetadata: z.record(z.string(), z.string()).optional().describe("Metadata for the file (max 4 key-value pairs)"),
});

// Step 1: Check current balance and storage metrics
const checkBalanceStep = createStep({
  id: "checkBalance",
  description: "Check current FIL/USDFC balances and storage metrics",
  inputSchema: e2eFileUploadInputSchema,
  outputSchema: z.object({
    balances: z.any(),
    needsPayment: z.boolean(),
    depositNeeded: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log("📊 STEP 1: Checking balances and storage metrics...");

    const fileInfo = await validateFilePath(inputData.filePath);
    const expectedStorageBytes = fileInfo.size;
    const dataSetId = inputData.datasetId ? BigInt(inputData.datasetId) : undefined;

    const result = await checkStorageBalance(expectedStorageBytes, inputData.persistenceDays, {
      notificationThresholdDays: inputData.notificationThresholdDays,
      upload: {
        isNewDataSet: dataSetId === undefined,
        dataSetId,
        withCDN: inputData.withCDN ?? false,
      },
    });

    return {
      balances: serializeBigInt(result),
      needsPayment: !result.isSufficient,
      depositNeeded: result.depositNeeded.toString(),
    };
  },
});

// Step 2: Process payment if needed
const processPaymentStep = createStep({
  id: "processPayment",
  description: "Deposit USDFC if insufficient balance detected",
  inputSchema: z.object({
    balances: z.any(),
    needsPayment: z.boolean(),
    depositNeeded: z.string(),
  }),
  outputSchema: z.object({
    skipped: z.boolean(),
    txHash: z.string().optional(),
    depositAmount: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async ({ getStepResult, getInitData }) => {
    const balanceInfo = getStepResult("checkBalance");
    const initData = getInitData();
    const persistenceDays = initData.persistenceDays ?? env.PERSISTENCE_PERIOD_DAYS;

    // Always process payment/allowances if needed, even if deposit is 0
    // This ensures rate and lockup allowances are properly set
    if (!balanceInfo.needsPayment) {
      console.log("✅ STEP 2: Balance and allowances are sufficient, skipping payment");
      return {
        skipped: true,
        message: "Payment not needed - balance and allowances sufficient",
      };
    }

    console.log("💰 STEP 2: Processing payment and/or setting allowances...");
    const depositNeeded = BigInt(balanceInfo.depositNeeded);
    if (depositNeeded > 0n) {
      console.log(`   Deposit needed: ${fromBaseUnits(depositNeeded, 18)} USDFC`);
    } else {
      console.log(`   Deposit sufficient, but allowances need to be set`);
    }
    console.log(`   Persistence period: ${persistenceDays} days`);

    const result = await processPaymentService(depositNeeded);

    // Check if the result indicates an error
    if (result.success === false || result.error) {
      throw new Error(`Payment failed: ${result.error || 'Unknown error'}`);
    }

    console.log(`✅ Payment/allowances processed successfully`);
    if (result.txHash) {
      console.log(`   TX Hash: ${result.txHash}`);
    }

    return {
      skipped: false,
      txHash: result.txHash ?? undefined,
      depositAmount: fromBaseUnits(depositNeeded, 18),
      message: "Payment processed",
    };
  },
});

// Step 3: Upload file to Filecoin
const uploadFileStep = createStep({
  id: "uploadFile",
  description: "Upload file to Filecoin storage",
  inputSchema: z.object({
    skipped: z.boolean(),
    txHash: z.string().optional(),
    depositAmount: z.string().optional(),
    message: z.string().optional(),
  }),
  outputSchema: z.object({
    pieceCid: z.string(),
    txHash: z.string().optional(),
    fileName: z.string(),
    fileSize: z.number(),
    progressLog: z.array(z.string()).optional(),
  }),
  execute: async ({ getInitData, runtimeContext }) => {
    const initData = getInitData();

    console.log("📤 STEP 3: Uploading file to Filecoin...");
    console.log(`   File: ${initData.filePath}`);

    const { uploadFile } = focStorageTools;
    const result = await uploadFile.execute!({
      context: {
        filePath: initData.filePath,
        datasetId: initData.datasetId,
        withCDN: initData.withCDN || false,
        autoPayment: false, // Already handled in step 2
        metadata: initData.fileMetadata,
      },
      runtimeContext,
    }) as UploadResponse;

    // Check if the result indicates an error
    if (result.success === false || result.error) {
      throw new Error(`File upload failed: ${result.error || 'Unknown error'}`);
    }

    console.log(`✅ File uploaded successfully`);
    console.log(`   Piece CID: ${result.pieceCid}`);
    console.log(`   File Name: ${result.fileName}`);
    console.log(`   File Size: ${result.fileSize} bytes`);

    return {
      pieceCid: result.pieceCid!,
      txHash: result.txHash,
      fileName: result.fileName!,
      fileSize: result.fileSize!,
      progressLog: result.progressLog,
    };
  },
});

// Step 4: Final summary
const summaryStep = createStep({
  id: "summary",
  description: "Generate final summary of the upload process",
  inputSchema: z.object({
    pieceCid: z.string(),
    txHash: z.string().optional(),
    fileName: z.string(),
    fileSize: z.number(),
    progressLog: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.object({
      balance: z.any(),
      payment: z.any(),
      upload: z.any(),
    }),
  }),
  execute: async ({ getStepResult }) => {
    const balanceInfo = getStepResult("checkBalance");
    const paymentInfo = getStepResult("processPayment");
    const uploadInfo = getStepResult("uploadFile");

    console.log("\n🎉 ============================================");
    console.log("   E2E FILE UPLOAD COMPLETED SUCCESSFULLY");
    console.log("============================================");
    console.log(`📊 Initial Balance Sufficient: ${balanceInfo.balances.isSufficient}`);

    if (!paymentInfo.skipped) {
      console.log(`💰 Payment Processed: ${paymentInfo.depositAmount} USDFC`);
      console.log(`   TX: ${paymentInfo.txHash}`);
    } else {
      console.log(`💰 Payment: Not needed (sufficient balance)`);
    }

    console.log(`📤 File Uploaded: ${uploadInfo.fileName}`);
    console.log(`   Size: ${uploadInfo.fileSize} bytes`);
    console.log(`   Piece CID: ${uploadInfo.pieceCid}`);
    if (uploadInfo.txHash) {
      console.log(`   TX: ${uploadInfo.txHash}`);
    }
    console.log("============================================\n");

    return {
      success: true,
      summary: {
        balance: balanceInfo.balances,
        payment: paymentInfo,
        upload: uploadInfo,
      },
    };
  },
});

// Define the workflow
export const e2eFileUploadWorkflow = createWorkflow({
  id: "e2eFileUpload",
  description: "Upload a file to Filecoin storage",
  inputSchema: e2eFileUploadInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.object({
      balance: z.any(),
      payment: z.any(),
      upload: z.any(),
    }),
  }),
}).then(checkBalanceStep)
  .then(processPaymentStep)
  .then(uploadFileStep)
  .then(summaryStep)
  .commit();
