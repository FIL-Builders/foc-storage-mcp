import { Synapse } from "@filoz/synapse-sdk";
import { http } from "viem";
import { account, chain } from "@/services/viem";

export const getSynapseInstance = async () => {
    return Synapse.create({
        account,
        chain,
        transport: http(),
        source: "foc-storage-mcp",
    });
};