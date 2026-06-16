import { fetchProviderSelectionInput } from "@filoz/synapse-core/warm-storage";
import type { PDPProvider } from "@filoz/synapse-core/sp-registry";
import { account, publicClient } from "./viem";

// We health-check providers with the SAME GET {serviceURL}/pdp/ping the SDK's
// SP.ping uses, but with a more forgiving timeout. The SDK hard-codes a 1s
// budget, which produces false negatives for providers that are healthy but
// slow to answer (observed ~1.7s on calibration) — they'd be wrongly excluded
// even though they accept uploads fine.
const PING_TIMEOUT_MS = 5000;
const PING_ATTEMPTS = 2;
const PING_RETRY_DELAY_MS = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pingOnce(serviceURL: string): Promise<void> {
  const url = new URL("pdp/ping", serviceURL).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function pingWithRetries(serviceURL: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < PING_ATTEMPTS; attempt++) {
    try {
      await pingOnce(serviceURL);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < PING_ATTEMPTS - 1) await delay(PING_RETRY_DELAY_MS);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider unreachable");
}

export interface HealthyProviderSelection {
  /** Provider IDs to pass to `createContext({ providerId })`, primary first. */
  providerIds: bigint[];
  /** Display name of the provider chosen for the primary copy (index 0). */
  primaryName: string;
  /** True when no endorsed provider was reachable and a non-endorsed approved
   * provider had to take the primary slot. */
  usedUnendorsedPrimary: boolean;
  requestedCopies: number;
  selectedCopies: number;
  /** True when fewer providers were reachable than the requested copy count. */
  reducedCopies: boolean;
  reachableCount: number;
  approvedCount: number;
}

/**
 * Pre-flight provider selection performed OUTSIDE the SDK's smartSelect.
 *
 * `synapse.storage.createContext()`/`createContexts()` delegate to smartSelect
 * when no explicit provider is given. smartSelect requires the primary copy to
 * come from the on-chain *endorsed* set and throws ("No endorsed provider
 * available — all failed health check") when every endorsed provider fails its
 * ping — even when other approved providers are healthy, and even when a healthy
 * provider is merely slow to answer the SDK's hard 1s ping. We instead fetch the
 * provider universe, ping each provider ourselves (forgiving timeout + retries),
 * and choose reachable providers: endorsed first (preserving the trust
 * preference for the primary), then any reachable approved provider. The chosen
 * ids are passed to `createContext({ providerId })`, which resolves them directly
 * and skips smartSelect entirely.
 *
 * Note: the providerId resolve path does NOT ping, so this health check is what
 * guarantees we target live providers.
 */
export async function selectHealthyProviders(
  requestedCopies: number,
): Promise<HealthyProviderSelection> {
  const input = await fetchProviderSelectionInput(publicClient, {
    address: account.address,
  });

  const approvedCount = input.providers.length;
  const endorsed = new Set(input.endorsedIds.map((id) => id.toString()));

  const pings = await Promise.allSettled(
    input.providers.map((p) => pingWithRetries(p.pdp.serviceURL)),
  );
  const reachable = input.providers.filter(
    (_, i) => pings[i].status === "fulfilled",
  );

  if (reachable.length === 0) {
    throw new Error(
      `No reachable storage providers (${approvedCount} approved, all failed their health check). ` +
        "Providers may be temporarily down — retry shortly.",
    );
  }

  // Endorsed first so the primary copy prefers the curated set; fall back to any
  // reachable approved provider for the primary when none are endorsed.
  const reachableEndorsed = reachable.filter((p) =>
    endorsed.has(p.id.toString()),
  );
  const reachableOther = reachable.filter(
    (p) => !endorsed.has(p.id.toString()),
  );
  const ordered = [...reachableEndorsed, ...reachableOther];

  const selectedCopies = Math.min(requestedCopies, ordered.length);
  const selected = ordered.slice(0, selectedCopies);
  const primary = selected[0];
  const primaryName =
    (primary as PDPProvider & { name?: string }).name ||
    `Provider #${primary.id.toString()}`;

  return {
    providerIds: selected.map((p) => p.id),
    primaryName,
    usedUnendorsedPrimary: reachableEndorsed.length === 0,
    requestedCopies,
    selectedCopies,
    reducedCopies: selectedCopies < requestedCopies,
    reachableCount: reachable.length,
    approvedCount,
  };
}
