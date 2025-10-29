import { createTool } from "@mastra/core";
import { GetProvidersOutputSchema, GetProvidersSchema } from "@/types";
import { getSynapseInstance, serializeBigInt, createErrorResponse } from "@/lib";
import { WarmStorageService, ProviderInfo } from "@filoz/synapse-sdk";

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
      const synapse = await getSynapseInstance();

      // Fetch all providers
      const warmStorageService = await WarmStorageService.create(
        synapse.getProvider(),
        synapse.getWarmStorageAddress()
      );
      const approvedProviderIds =
        await warmStorageService.getApprovedProviderIds();

      // Fetch provider info
      const providersInfo = await Promise.all(
        approvedProviderIds.map(async (providerId: number) => {
          const providerInfo = await synapse.getProviderInfo(providerId);
          return providerInfo;
        })
      );

      // Filter to approved providers if requested
      const providers =
        context.onlyApproved !== false
          ? providersInfo.filter((p: ProviderInfo) =>
            approvedProviderIds.includes(p.id)
          )
          : providersInfo;

      return {
        success: true,
        providers: providers.map(serializeBigInt),
        count: providers.length,
        message: `Found ${providers.length} provider(s)`,
      };
    } catch (error) {
      return createErrorResponse(
        "provider_fetch_failed",
        `Failed to fetch providers: ${(error as Error).message}`
      ) as any;
    }
  },
});

// Export all provider tools
export const providerTools = {
  getProviders,
};
