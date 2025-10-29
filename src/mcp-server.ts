#!/usr/bin/env node

// Load environment variables first, before any other imports
import { config } from "dotenv";
config();

import { mcpServer } from "@/mastra/index";

async function startMCPServer() {
  try {
    console.log("🚀 Starting FOC Storage MCP Server...");
    console.log("📦 Exposing tools: uploadFile, uploadWithProgress, getDatasets, createDataset, getBalances, processPayment, getProviders");

    // Start in stdio mode for command-line usage
    await mcpServer.startStdio();
  } catch (error) {
    console.error("❌ Error starting MCP server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down MCP server...");
  await mcpServer.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down MCP server...");
  await mcpServer.close();
  process.exit(0);
});

startMCPServer();
