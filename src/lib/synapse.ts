import { Synapse, SynapseOptions } from "@filoz/synapse-sdk";
import { env, NETWORK_CONFIGS } from "../config";

export const getSynapseInstance = async () => {
    const network = env.FILECOIN_NETWORK;
    const synapse = await Synapse.create(
        {
            privateKey: env.PRIVATE_KEY,
            rpcURL: NETWORK_CONFIGS[network].rpcUrl,
        }
    );
    return synapse;
};