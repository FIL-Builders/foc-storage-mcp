# Filecoin Onchain Cloud MCP

> ⚠️ **DEPRECATED — This repository is archived and no longer maintained.**
>
> 👉 **Use [`foc-cli`](https://github.com/FIL-Builders/foc-cli) instead.**
>
> `foc-cli` is the official successor. It includes everything this MCP server did, plus a full CLI, AI agent skills, and richer tooling for Filecoin Onchain Cloud.

[![Status: Archived](https://img.shields.io/badge/status-archived-red)](https://github.com/FIL-Builders/foc-cli)
[![Replacement: foc-cli](https://img.shields.io/badge/replacement-foc--cli-blue)](https://github.com/FIL-Builders/foc-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📣 Migration Notice

`@fil-b/foc-storage-mcp` has been replaced by **[`foc-cli`](https://github.com/FIL-Builders/foc-cli)** — a single package that provides:

- ✅ **MCP server** — same agent-facing tools you had here, kept in sync with the SDK
- ✅ **CLI** — direct terminal access (`npx foc-cli upload ./file.pdf`)
- ✅ **AI agent skills** via [skills.sh](https://skills.sh) — works with Claude Code, Cursor, Copilot, Codex, Windsurf, and 20+ AI tools
- ✅ **Active maintenance** — built on the latest [Synapse SDK](https://github.com/FilOzone/synapse-sdk)
- ✅ **Expanded features** — multi-upload, redundant copies, structured output (`--json`, `--format yaml`), schema introspection, and more

If you were using this MCP server, switching takes one command.

### Quick migration

**Before** (this archived repo):

```json
{
  "mcpServers": {
    "foc-storage": {
      "command": "npx",
      "args": ["-y", "@fil-b/foc-storage-mcp"],
      "env": { "PRIVATE_KEY": "0x...", "FILECOIN_NETWORK": "calibration" }
    }
  }
}
```

**After** (`foc-cli`):

```bash
# Auto-detect your agent and install
npx foc-cli mcp add

# Or target a specific agent
npx foc-cli mcp add --agent claude-code
```

Or install as an AI agent skill (recommended for Claude Code, Cursor, and similar):

```bash
npx skills add FIL-Builders/foc-cli
```

See the [foc-cli README](https://github.com/FIL-Builders/foc-cli) for full setup and command reference.

### Tool mapping

Every tool from this MCP server has an equivalent in `foc-cli`:

| Old MCP tool (`@fil-b/foc-storage-mcp`) | New in `foc-cli` |
| --- | --- |
| `uploadFile` | `foc-cli upload <path>` / MCP `upload` tool |
| `getDatasets` | `foc-cli dataset list` |
| `getDataset` | `foc-cli dataset details -d <id>` |
| `createDataset` | `foc-cli dataset create` |
| `getBalances` | `foc-cli wallet balance` / `wallet summary` |
| `processPayment` | `foc-cli wallet deposit <amount>` |
| `getProviders` | `foc-cli provider list` |
| `estimateStoragePricing` | `foc-cli wallet costs --extraBytes <n> --extraRunway <months>` |
| `getStoragePricingInfo` | `foc-cli docs --prompt "pricing"` |
| `convertStorageSize` | Handled natively by CLI flags |

---

## About this archive

The sections below describe `@fil-b/foc-storage-mcp` as it was when this repository was active. They are preserved for reference only — **no further updates, bug fixes, or security patches will be issued**. Please migrate to [`foc-cli`](https://github.com/FIL-Builders/foc-cli).

<details>
<summary><strong>Click to expand original README</strong></summary>

### What it was

`@fil-b/foc-storage-mcp` provided AI agents with access to Filecoin's decentralized storage network through the Model Context Protocol (MCP). It supported file upload with automatic USDFC payment handling, dataset organization, CDN-backed retrieval, and cost estimation.

### Original tools (10)

**File operations**

- `uploadFile` — Upload files with auto-payment
- `getDatasets` — List all stored datasets
- `getDataset` — Get dataset details
- `createDataset` — Create new dataset container

**Balance & payments**

- `getBalances` — Check wallet and storage metrics
- `processPayment` — Deposit USDFC tokens

**Providers & pricing**

- `getProviders` — List storage providers
- `estimateStoragePricing` — Calculate costs
- `getStoragePricingInfo` — Explain pricing models
- `convertStorageSize` — Convert units

### Original configuration

**Requirements:** Node.js >= 20.10.0, `PRIVATE_KEY` env var (Filecoin wallet, `0x...`)

**Optional env vars:**

- `FILECOIN_NETWORK` — `mainnet` or `calibration` (default)
- `TOTAL_STORAGE_NEEDED_GiB` — default 150
- `PERSISTENCE_PERIOD_DAYS` — default 365
- `RUNOUT_NOTIFICATION_THRESHOLD_DAYS` — default 45 (recommended >30; Filecoin warm storage requires 30 days paid upfront)

### Original pricing

Storage was billed at $2.50/TiB/month, paid per-epoch (30s), with a minimum of $0.06/month. Example: 150 GiB for 1 year ≈ 0.44 USDFC.

These economics are unchanged in `foc-cli`, which uses the same Filecoin Warm Storage Service (FWSS) under the hood.

</details>

---

## Links

- 🚀 **Replacement:** [FIL-Builders/foc-cli](https://github.com/FIL-Builders/foc-cli)
- 📦 NPM (replacement): [foc-cli](https://www.npmjs.com/package/foc-cli)
- 📚 [Filecoin Onchain Cloud Docs](https://docs.filecoin.cloud)
- 🤖 [MCP Protocol](https://modelcontextprotocol.io/)
- 🛠 [Skills.sh](https://skills.sh)

## License

MIT © [@nijoe1](https://github.com/nijoe1)

---

Built with ❤️ by [@FILBuilders](https://github.com/FIL-Builders) for the Filecoin ecosystem.
