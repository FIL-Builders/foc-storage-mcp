import { createPublicClient, createWalletClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { calibration, mainnet } from "@filoz/synapse-core/chains";
import { env } from "@/config";

export const account = privateKeyToAccount(env.PRIVATE_KEY as Hex);

export const chain = env.FILECOIN_NETWORK === "calibration" ? calibration : mainnet;

export const client = createWalletClient({
    account,
    chain,
    transport: http(),
});

export const publicClient = createPublicClient({
    chain,
    transport: http(),
});
