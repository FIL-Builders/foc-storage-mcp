import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = path.join(process.cwd(), "dist", "stdio.js");
const expectedTools = [
  "estimateStoragePricing",
  "getProviders",
  "getBalances",
  "getDatasets",
];

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;

function envForChild(): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  if (!/^0x[0-9a-fA-F]{64}$/.test(env.PRIVATE_KEY ?? "")) {
    env.PRIVATE_KEY = `0x${"1".repeat(64)}`;
  }
  env.FILECOIN_NETWORK ??= "calibration";

  return env;
}

function payloadFromResult(result: ToolCallResult): Record<string, unknown> | undefined {
  if ("structuredContent" in result && result.structuredContent) {
    return result.structuredContent;
  }

  if ("toolResult" in result && typeof result.toolResult === "object" && result.toolResult !== null) {
    return result.toolResult as Record<string, unknown>;
  }

  if ("content" in result) {
    const textContent = result.content.find((item) => item.type === "text");
    if (textContent) {
      try {
        const parsed = JSON.parse(textContent.text);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function assertToolSucceeded(name: string, result: ToolCallResult): void {
  if ("isError" in result && result.isError) {
    throw new Error(`${name} returned an MCP error: ${JSON.stringify(result)}`);
  }

  const payload = payloadFromResult(result);
  if (payload?.success === false) {
    throw new Error(`${name} returned success=false: ${JSON.stringify(payload)}`);
  }
}

async function main(): Promise<void> {
  if (!existsSync(serverPath)) {
    throw new Error("dist/stdio.js was not found. Run `npm run build:mcp` before `npm run smoke:mcp:readonly`.");
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: process.cwd(),
    env: envForChild(),
    stderr: "pipe",
  });
  const stderrChunks: string[] = [];
  transport.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const client = new Client({ name: "foc-storage-mcp-readonly-smoke", version: "0.0.0" });

  try {
    await client.connect(transport, { timeout: 30_000 });

    const listed = await client.listTools(undefined, { timeout: 30_000 });
    const toolNames = new Set(listed.tools.map((tool) => tool.name));
    for (const toolName of expectedTools) {
      if (!toolNames.has(toolName)) {
        throw new Error(`Expected MCP tool ${toolName} was not listed`);
      }
    }

    const calls: Array<[string, Record<string, unknown>]> = [
      ["estimateStoragePricing", { sizeInGiB: 1, durationInMonths: 1 }],
      ["getProviders", { onlyApproved: true }],
      ["getBalances", {}],
      ["getDatasets", { includeAllDatasets: true }],
    ];

    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
      assertToolSucceeded(name, result);
    }

    console.log(`MCP read-only smoke passed: ${expectedTools.join(", ")}`);
  } catch (error) {
    const stderr = stderrChunks.join("").trim();
    if (stderr) {
      console.error(stderr);
    }
    throw error;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
