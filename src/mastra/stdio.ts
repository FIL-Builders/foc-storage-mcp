#!/usr/bin/env node
import { MCPServer } from "@mastra/mcp";
import { focStorageTools } from "@/mastra/tools";
import { focStorageResources } from "./resources";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

// Create MCP Server to expose tools and agents
const server = new MCPServer({
    name: "FOC Storage MCP",
    version: "0.2.5",
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
    resources: focStorageResources
});

server.startStdio().catch((error) => {
    console.error("Error running MCP server:", error);
    process.exit(1);
});