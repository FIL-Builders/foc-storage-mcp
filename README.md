# Filecoin Onchain Cloud MCP

> MCP server for decentralized file storage on Filecoin Onchain Cloud

[![NPM Version](https://img.shields.io/npm/v/@fil-b/foc-storage-mcp)](https://www.npmjs.com/package/@fil-b/foc-storage-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/@fil-b/foc-storage-mcp)](https://nodejs.org)

**@fil-b/foc-storage-mcp** provides AI agents with seamless access to Filecoin's decentralized storage network through the Model Context Protocol (MCP). Store files persistently with automatic payment handling, CDN support, and comprehensive dataset management.

## Features

- 🛠️ **10 MCP Tools** - Upload, manage, and price storage operations
- 📁 **Dataset Organization** - Group related files efficiently
- 💳 **Automatic Payments** - Built-in USDFC handling with gasless permits
- ⚡ **CDN Support** - Fast retrieval for frequently accessed files
- 💰 **Cost Estimation** - Calculate costs, explain pricing, convert units
- 🤖 **AI-Ready** - Designed for Claude, Cursor, and MCP clients

## Configuration

**Requirements:**

- Node.js >= 20.10.0 ([Check version](https://nodejs.org/): `node --version`)
- `PRIVATE_KEY` - Your Filecoin wallet private key (0x...)

**Optional:**

- `FILECOIN_NETWORK` - `mainnet` (production) or `calibration` (testing, default)
- `TOTAL_STORAGE_NEEDED_GiB` - Default storage capacity for calculations (default: 150 GiB)
- `PERSISTENCE_PERIOD_DAYS` - Data retention duration (default: 365 days)
- `RUNOUT_NOTIFICATION_THRESHOLD_DAYS` - Balance warning threshold (default: 45 days, **recommended >30**)

> **Note:** Filecoin warm storage requires 30 days paid upfront. Keep balance above 30 days to maintain service.

## Installation

**Jump to:** [Cursor](#cursor) | [Claude Code](#claude-code) | [Claude Desktop](#claude-desktop) | [VS Code](#vs-code) | [Windsurf](#windsurf) | [Codex](#openai-codex) | [Other](#other-tools)

### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=foc-storage&config=eyJlbnYiOnsiUFJJVkFURV9LRVkiOiJ5b3VyX3ByaXZhdGVfa2V5X2hlcmUiLCJGSUxFQ09JTl9ORVRXT1JLIjoiY2FsaWJyYXRpb24ifSwiY29tbWFuZCI6Im5weCAteSBAZmlsLWIvZm9jLXN0b3JhZ2UtbWNwIn0%3D)

After installation, update `PRIVATE_KEY` in your config. [Learn more](https://cursor.com/de/docs/context/mcp)

### Claude Code

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "foc-storage": {
      "command": "npx",
      "args": ["-y", "@fil-b/foc-storage-mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here",
        "FILECOIN_NETWORK": "calibration"
      }
    }
  }
}
```

[Learn more](https://docs.claude.com/en/docs/claude-code/mcp)

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "foc-storage": {
      "command": "npx",
      "args": ["-y", "@fil-b/foc-storage-mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here",
        "FILECOIN_NETWORK": "calibration"
      }
    }
  }
}
```

[Learn more](https://modelcontextprotocol.io/quickstart/user)

### VS Code

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "foc-storage": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@fil-b/foc-storage-mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here",
        "FILECOIN_NETWORK": "calibration"
      }
    }
  }
}
```

Enable: Settings → Chat → MCP. Click "start" in `mcp.json` (Agent mode only). [Learn more](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "foc-storage": {
      "command": "npx",
      "args": ["-y", "@fil-b/foc-storage-mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here",
        "FILECOIN_NETWORK": "calibration"
      }
    }
  }
}
```

Restart Windsurf. [Learn more](https://docs.windsurf.com/windsurf/cascade/mcp)

### OpenAI Codex

```bash
codex mcp add foc-storage -- npx -y @fil-b/foc-storage-mcp
```

Edit config to add environment variables. Verify: `codex mcp list`. [Learn more](https://developers.openai.com/codex/mcp)

### Other Tools

Most MCP tools support this format:

```json
{
  "mcpServers": {
    "foc-storage": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@fil-b/foc-storage-mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here",
        "FILECOIN_NETWORK": "calibration"
      }
    }
  }
}
```

## Pricing

**Storage:** $2.50/TiB/month (pay-per-epoch: 30 seconds) • Min: $0.06/month

**CDN Egress:** $7/TiB downloaded • 1 USDFC = ~146 GiB credits

**Example:** 150 GiB for 1 year ≈ 0.44 USDFC ($0.44)

💡 Ask your agent: _"How much to store 500 GiB for 6 months?"_

## Tools

Ask naturally in Claude, Cursor, or any MCP client:

**File Operations**

- `uploadFile` - Upload files with auto-payment
- `getDatasets` - List all stored datasets
- `getDataset` - Get dataset details
- `createDataset` - Create new dataset container

**Balance & Payments**

- `getBalances` - Check wallet and storage metrics
- `processPayment` - Deposit USDFC tokens

**Providers & Pricing**

- `getProviders` - List storage providers
- `estimateStoragePricing` - Calculate costs
- `getStoragePricingInfo` - Explain pricing models
- `convertStorageSize` - Convert units

## Usage Examples

```
"Check my storage balance"
"Upload presentation.pdf with CDN enabled"
"How much to store 2 TB for 1 year?"
"Create a dataset for Q4 reports"
"Show all my datasets"
```

## Troubleshooting

**Server not found:** Verify `npx --version`, check JSON syntax, restart IDE

**"PRIVATE_KEY is required":** Add to `env` section, must start with `0x`

**Transaction fails:** Check FIL for gas, verify network setting, confirm USDFC balance

**"Invalid Version" or npm dependency errors:**

1. Clear npm cache: `npm cache clean --force`
2. Clear npx cache: `npx clear-npx-cache`
3. Update npm: `npm install -g npm@latest`
4. As last resort, use older npm: `npm install -g npm@10`

## Security

- Never commit private keys or `.env` files
- Test on Calibration network before mainnet
- Keep balance >30 days (Filecoin warm storage requirement)
- Monitor balance regularly with `getBalances`
- Use hardware wallets for production

## Links

- [GitHub](https://github.com/FIL-Builders/foc-storage-mcp)
- [NPM](https://www.npmjs.com/package/@fil-b/foc-storage-mcp)
- [Filecoin Docs](https://docs.filecoin.io/)
- [MCP Protocol](https://modelcontextprotocol.io/)

## Contributing

Contributions welcome! Open an issue for major changes.

## License

MIT © [@nijoe1](https://github.com/nijoe1)

---

Built with ❤️ by @FILBuilders for the Filecoin ecosystem
