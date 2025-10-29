# Filecoin Onchain Cloud MCP

> MCP server for decentralized file storage on Filecoin Onchain Cloud

[![NPM Version](https://img.shields.io/npm/v/@fil-b/foc-storage-mcp)](https://www.npmjs.com/package/@fil-b/foc-storage-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/@fil-b/foc-storage-mcp)](https://nodejs.org)

## Overview

**@fil-b/foc-storage-mcp** is a Model Context Protocol (MCP) server that provides AI agents with seamless access to Filecoin's decentralized storage network. Powered by the FOC-Synapse SDK, it enables intelligent applications to store files persistently on Filecoin with automatic payment handling, CDN support, and comprehensive dataset management.

Perfect for building AI applications that need persistent, censorship-resistant storage without managing blockchain complexity.

## Features

- 🛠️ **7 MCP Tools**: Complete file storage operations via Model Context Protocol
- 📁 **Dataset Organization**: Group and manage related files efficiently
- 💳 **Automatic Payment**: Built-in USDFC payment handling with EIP-2612 gasless permits
- ⚡ **CDN Support**: Optional fast retrieval for frequently accessed files
- 📊 **Balance Monitoring**: Comprehensive storage metrics and wallet tracking
- 🔧 **Provider Selection**: Choose from approved Filecoin storage providers
- 🤖 **AI-Ready**: Designed for AI agents and MCP clients
- 🔒 **Censorship-Resistant**: Leverage Filecoin's decentralized storage network

## Quick Start

### Using with MCP Clients

Add the following configuration to your MCP client:

- **Claude Desktop**: `claude_desktop_config.json`
- **Cursor**: `mcp.json`
- **Claude Code**: `.mcp.json`

```json
{
  "mcpServers": {
    "foc-storage": {
      "command": "npx",
      "args": ["@fil-b/foc-storage-mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

### Configuration

| Variable                             | Required | Default       | Description                                                     |
| ------------------------------------ | -------- | ------------- | --------------------------------------------------------------- |
| `PRIVATE_KEY`                        | **Yes**  | -             | Wallet private key for transaction signing (must start with 0x) |
| `FILECOIN_NETWORK`                   | No       | `calibration` | Network: `mainnet` for production, `calibration` for testing    |
| `TOTAL_STORAGE_NEEDED_GiB`           | No       | `1024`        | Storage capacity in GiB for balance calculations                |
| `PERSISTENCE_PERIOD_DAYS`            | No       | `365`         | Data retention duration in days                                 |
| `RUNOUT_NOTIFICATION_THRESHOLD_DAYS` | No       | `10`          | Balance warning threshold in days                               |

## MCP Tools Reference

Seven tools to interact with Filecoin storage through your AI agent. Simply ask Claude, Cursor, or your MCP client naturally.

### `uploadFile`

Upload files to decentralized storage with automatic payment handling.

**Key inputs:** `filePath` (required), `withCDN`, `metadata`, `datasetId`

**How to use:**

```
"Upload my presentation.pdf to Filecoin with CDN enabled"
"Store /docs/report.pdf to dataset 123 with metadata category=financial"
"Upload this file to permanent storage"
```

### `getDatasets`

List all your stored datasets with file information and retrieval URLs.

**Key inputs:** `includeAllDatasets`, `filterByCDN`

**How to use:**

```
"Show me all my datasets"
"List my CDN-enabled datasets"
"What files have I stored on Filecoin?"
```

### `getDataset`

Get detailed information about a specific dataset including all files.

**Key inputs:** `datasetId` (required)

**How to use:**

```
"Show me dataset 123"
"Get details for my Q4 reports dataset"
"What's in dataset abc123?"
```

### `createDataset`

Create a new container to organize related files together.

**Key inputs:** `withCDN`, `providerId`, `metadata`

**How to use:**

```
"Create a new dataset with CDN for my project files"
"Make a dataset called 'Q4-Reports' with metadata project=quarterly"
"Create a storage dataset for organizing my documents"
```

### `getBalances`

Check your wallet balance and storage metrics.

**Key inputs:** `storageCapacityBytes`, `persistencePeriodDays`, `notificationThresholdDays`

**How to use:**

```
"Check my storage balance"
"How much USDFC do I have?"
"Show my wallet balance and storage status"
```

### `processPayment`

Deposit USDFC tokens to fund storage operations.

**Key inputs:** `depositAmount`

**How to use:**

```
"Deposit 100 USDFC for storage"
"Add funds to my storage wallet"
"Process payment of 50 USDFC"
```

### `getProviders`

List available Filecoin storage providers.

**Key inputs:** `onlyApproved`

**How to use:**

```
"Show me available storage providers"
"List approved Filecoin providers"
"What providers can I use?"
```

## Common Workflows

### First-Time File Upload

```
You: "Check my storage balance"
Agent: Shows 0 USDFC available

You: "Deposit 100 USDFC for storage"
Agent: Processes payment, shows updated balance

You: "Upload /documents/report.pdf with CDN enabled"
Agent: Uploads file, returns retrieval URL
```

### Organized Storage with Datasets

```
You: "Create a dataset with CDN called Q4-Reports"
Agent: Creates dataset, returns ID: 123

You: "Upload /reports/q4-summary.pdf to dataset 123"
Agent: Uploads first file to dataset

You: "Upload /reports/q4-details.pdf to dataset 123"
Agent: Uploads second file to dataset

You: "Show me dataset 123"
Agent: Lists all files in the Q4-Reports dataset
```

### Monitoring Storage

```
You: "Check my storage balance and metrics"
Agent: Shows FIL/USDFC balances, storage days remaining

You: "List all my datasets"
Agent: Displays all stored datasets with file counts

You: "What's my storage status?"
Agent: Reports current usage and alerts if balance is low
```

## Security Notes

🔐 **Important Security Considerations:**

- **Never commit `.env` files** or expose private keys in code repositories
- **Use environment variables** for all sensitive configuration
- **Test on Calibration network** before mainnet deployment to avoid real funds loss
- **Validate file paths** before upload operations to prevent unauthorized access
- **Monitor balance regularly** to avoid service interruptions
- **Review transaction details** before confirming operations
- **Use hardware wallets** for production deployments with significant funds
- **Limit private key exposure** by using separate wallets for storage operations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT © [@nijoe1](https://github.com/nijoe1)

## Links

- **GitHub Repository**: [FIL-Builders/foc-storage-mcp](https://github.com/FIL-Builders/foc-storage-mcp)
- **NPM Package**: [@fil-b/foc-storage-mcp](https://www.npmjs.com/package/@fil-b/foc-storage-mcp)
- **Filecoin Documentation**: [docs.filecoin.io](https://docs.filecoin.io/)
- **Synapse SDK**: [filecoin-project/synapse-sdk](https://github.com/FilOzone/synapse-sdk)
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Mastra Framework**: [mastra.ai](https://mastra.ai)

## Support

- **Issues**: [GitHub Issues](https://github.com/FIL-Builders/foc-storage-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/FIL-Builders/foc-storage-mcp/discussions)

---

Built with ❤️ from @FILBuilers for the Filecoin ecosystem
