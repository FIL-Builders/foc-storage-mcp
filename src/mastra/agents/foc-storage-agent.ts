import { Agent } from "@mastra/core/agent";
import { focStorageTools } from "@/mastra/tools";
import { e2eFileUploadWorkflow } from "@/mastra/workflows";
import { instructions } from "@/mastra/resources/instructions";

export const focStorageAgent = new Agent({
  name: "FOCStorageAgent",
  description:
    "AI agent for managing decentralized file storage on Filecoin via FOC-Synapse SDK. Handles file uploads, dataset management, balance checking, and storage operations.",
  instructions,
  model: "openai/gpt-5-mini",
  tools: focStorageTools,
  workflows: {
    e2eFileUpload: e2eFileUploadWorkflow,
  },
});
