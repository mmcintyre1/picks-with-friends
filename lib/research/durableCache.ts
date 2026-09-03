import { getStore } from "@netlify/blobs";

// Shared cache layer for every research provider's real vendor calls. Two layers, not one:
//
// 1. An in-memory Map, exactly like the per-provider caches this app already used --
//    survives for the lifetime of one warm server instance, but NOT across a serverless
//    cold start. Confirmed real limitation for this app's actual deployment target
//    (Netlify): each function invocation can get a fresh module scope with no guarantee of
//    landing on the same warm instance as the last request, so an in-memory-only cache
//    doesn't reliably protect a vendor's rate/volume limit under real concurrent friend-
//    group usage.
// 2. Netlify Blobs, a durable store that survives across invocations/cold starts -- this is
//    what actually protects a monthly entity budget (SportsGameOdds' real binding
//    constraint, confirmed via its own /account/usage/ endpoint) rather than just a
//    same-instance rate burst (SharpAPI's constraint, which the in-memory layer alone
//    already handles fine).
//
// Netlify Blobs has no local emulation under plain `next dev` (only under `netlify dev`,
// which this project doesn't use) -- confirmed real via a live test: getStore() throws
// MissingBlobsEnvironmentError synchronously when the environment isn't configured. Every
// Blobs call here is wrapped accordingly, so local dev transparently falls back to
// in-memory-only caching (identical behavior to before this file existed) and the durable
// layer only actually engages once deployed to Netlify.
const memoryCache = new Map<string, { expires: number; data: unknown }>();

type CacheEntry<T> = { expires: number; data: T };

function memoryKey(storeName: string, key: string): string {
  return `${storeName}:${key}`;
}

async function readBlob<T>(storeName: string, key: string): Promise<CacheEntry<T> | null> {
  try {
    const store = getStore(storeName);
    const entry = await store.get(key, { type: "json" });
    return (entry as CacheEntry<T> | null) ?? null;
  } catch {
    return null;
  }
}

async function writeBlob<T>(storeName: string, key: string, entry: CacheEntry<T>): Promise<void> {
  try {
    const store = getStore(storeName);
    await store.setJSON(key, entry);
  } catch {
    // Not configured (local `next dev`) -- the in-memory layer above still covers this
    // instance's own lifetime, so this is a silent no-op, not a real failure.
  }
}

// Fetches `key` from cache (memory first, then the durable Blobs layer), or calls `fetcher`
// and populates both layers on a miss. `fetcher` returns its own TTL alongside the data --
// SharpAPI's real TTL is dynamic (anchored to the vendor's own disclosed data_delay_seconds,
// only known once the response arrives), so the TTL can't always be a fixed value known
// before fetching; SportsGameOdds' fetcher just always returns the same fixed number.
// `fetcher` throwing (a real rate-limit/upstream error) propagates directly -- an error is
// never cached, only a real successful result is, so a temporary vendor outage doesn't get
// "remembered" past its own natural retry.
export async function getOrSetCached<T>(
  storeName: string,
  key: string,
  fetcher: () => Promise<{ data: T; ttlSeconds: number }>,
): Promise<T> {
  const memHit = memoryCache.get(memoryKey(storeName, key)) as CacheEntry<T> | undefined;
  if (memHit && memHit.expires > Date.now()) return memHit.data;

  const blobHit = await readBlob<T>(storeName, key);
  if (blobHit && blobHit.expires > Date.now()) {
    memoryCache.set(memoryKey(storeName, key), blobHit);
    return blobHit.data;
  }

  const { data, ttlSeconds } = await fetcher();
  const entry: CacheEntry<T> = { expires: Date.now() + ttlSeconds * 1000, data };
  memoryCache.set(memoryKey(storeName, key), entry);
  await writeBlob(storeName, key, entry);
  return data;
}

export function __resetDurableCacheForTests() {
  memoryCache.clear();
}
