import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { MCPServer } from "@mastra/mcp";

import { focStorageAgent } from "@/mastra/agents";
import { focStorageTools } from "@/mastra/tools";
import { e2eFileUploadWorkflow } from "@/mastra/workflows/e2e-file-upload";
import { focStorageResources } from "@/mastra/resources";

// Create MCP Server to expose tools and agents
export const mcpServer = new MCPServer({
  name: "FOC Storage MCP",
  version: "0.1.7",
  description:
    "Professional-grade MCP server for decentralized file storage on Filecoin Onchain Cloud. Powered by the FOC-Synapse SDK, this server provides AI agents with seamless access to Filecoin's distributed storage network. Upload files with automatic payment handling, organize content in datasets, monitor storage balances, and manage providers - all through intuitive MCP tools. Supports both standard storage and CDN-enabled fast retrieval. Perfect for building AI applications that need persistent, censorship-resistant storage.",
  tools: focStorageTools,
  repository: {
    url: "https://github.com/FIL-Builders/foc-storage-mcp",
    source: "github",
    id: "foc-storage-mcp",
  },
  releaseDate: new Date().toISOString(),
  isLatest: true,
  packageCanonical: "npm",
  resources: focStorageResources,
});

export const mastra = new Mastra({
  agents: {
    focStorageAgent,
  },
  workflows: {
    e2eFileUpload: e2eFileUploadWorkflow,
  },
  mcpServers: {
    focStorageServer: mcpServer,
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "silent",
  }),
  bundler: {
    externals: ["@filoz/synapse-sdk"],
  },
});
