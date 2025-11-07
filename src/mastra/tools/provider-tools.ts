import { createTool } from "@mastra/core";
import { GetProvidersOutputSchema, GetProvidersSchema } from "@/types";
import { serializeBigInt } from "@/lib";
import { publicClient } from "@/services/viem";
import { readProviders } from "@filoz/synapse-core/warm-storage";

/**
 * Provider tools for FOC storage operations.
 */
export const getProviders = createTool({
  id: "getProviders",
  description:
    "List storage providers available on the Filecoin network with their service details, product offerings, and endpoint URLs. By default returns only approved providers for reliability. Use this to discover available providers, select specific providers for dataset creation, or verify provider availability before operations. Provider information includes service URLs needed for file retrieval.",
  inputSchema: GetProvidersSchema,
  outputSchema: GetProvidersOutputSchema,
  execute: async ({ context }) => {
    try {
      // Fetch all providers using publicClient (respects env.FILECOIN_NETWORK)
      const providers = (await readProviders(
        publicClient,
      )).filter((p) =>
        context.onlyApproved ? p.isActive : true
      );

      return {
        success: true,
        providers: providers.map(serializeBigInt),
        count: providers.length,
        message: `Found ${providers.length} provider(s)`,
      };
    } catch (error) {
      return {
        success: false,
        providers: [],
        error: (error as Error).message,
        message: `Failed to fetch providers: ${(error as Error).message}`,
      };
    }
  },
});

// Export all provider tools
export const providerTools = {
  getProviders,
};
