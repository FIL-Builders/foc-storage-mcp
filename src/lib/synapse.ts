import { Synapse } from "@filoz/synapse-sdk";
import { http } from "viem";
import { account, chain } from "@/services/viem";
import { env } from "@/config";

export const getSynapseInstance = async () => {
    return Synapse.create({
        account,
        chain,
        transport: http(),
        source: env.SYNAPSE_SOURCE,
    });
};