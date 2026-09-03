import { getOrSetCached } from "@/lib/research/durableCache";

import { SharpApiProviderError } from "./types";
import type { SharpApiProvider, SharpApiResponse, SharpApiRow } from "./types";

const BASE_URL = "https://api.sharpapi.io/api/v1/odds";
const DEFAULT_TTL_SECONDS = 90; // anchored below to the live data_delay_seconds once known
const CACHE_STORE = "sharpapi";

// Confirmed real page sizes: schedule discovery (market=moneyline) surfaced 14 distinct
// games on a single 50-row page -- 4 pages has real headroom for a full week's slate.
// A single game's full board (every segment/prop, including alternate lines) is much
// bigger than first assumed: one real event needed 9 pages (406 rows) once alternate
// lines/segments/TD-scorer markets are all included, confirmed via a real deep pull. 20
// gives real headroom above that without being unbounded -- see fetchAllPages' rate-limit
// handling below for what happens if that's still not enough on a busier slate.
const SCHEDULE_MAX_PAGES = 4;
const EVENT_MAX_PAGES = 20;

async function fetchPage(url: string, apiKey: string): Promise<SharpApiResponse> {
  const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
  if (res.status === 429) {
    throw new SharpApiProviderError("rate_limited", "SharpAPI rate limit reached.");
  }
  if (!res.ok) {
    throw new SharpApiProviderError("upstream_error", `SharpAPI returned ${res.status}.`);
  }
  return res.json();
}

async function fetchAllPages(baseUrl: string, apiKey: string, maxPages: number): Promise<{ rows: SharpApiRow[]; ttlSeconds: number }> {
  const rows: SharpApiRow[] = [];
  let offset = 0;
  let ttlSeconds = DEFAULT_TTL_SECONDS;

  for (let page = 0; page < maxPages; page++) {
    let response: SharpApiResponse;
    try {
      response = await fetchPage(`${baseUrl}&offset=${offset}`, apiKey);
    } catch (error) {
      // A single game's full board can need close to the free tier's entire 12-req/min
      // budget by itself (confirmed real: 9 pages for one event). If the limit is hit
      // partway through, whatever's already been fetched is still real and useful --
      // return it rather than throwing away a near-complete board. Only the very first
      // page failing is truly fatal (there's nothing to show at all).
      if (error instanceof SharpApiProviderError && error.kind === "rate_limited" && rows.length > 0) break;
      throw error;
    }
    rows.push(...response.data);
    // The vendor's own disclosed delay is the real floor for how fresh this data can ever
    // be -- no point caching for less than that, and a future paid (shorter-delay) tier
    // automatically tightens the cache with no code change.
    if (response.meta?.tier?.data_delay_seconds) {
      ttlSeconds = Math.max(response.meta.tier.data_delay_seconds + 30, DEFAULT_TTL_SECONDS);
    }
    if (!response.pagination?.has_more) break;
    offset = response.pagination.next_offset;
  }

  return { rows, ttlSeconds };
}

function requireApiKey(): string {
  const apiKey = process.env.SHARPAPI_KEY;
  if (!apiKey) {
    throw new SharpApiProviderError("missing_key", "SHARPAPI_KEY is not set.");
  }
  return apiKey;
}

// Real, live implementation -- confirmed against SharpAPI's actual free-tier responses
// during Phase 2.14 planning/implementation (see the plan file). Two real, distinct entry
// points, not one broad "everything" fetch: a cheap schedule discovery filtered to real
// games only, and a per-event fetch for one game's full board once the user drills into it.
export function createSharpApiProvider(): SharpApiProvider {
  return {
    async listNflSchedule(): Promise<SharpApiRow[]> {
      return getOrSetCached(CACHE_STORE, "schedule", async () => {
        const apiKey = requireApiKey();
        const { rows, ttlSeconds } = await fetchAllPages(
          `${BASE_URL}?league=nfl&market=moneyline&sportsbook=draftkings,fanduel`,
          apiKey,
          SCHEDULE_MAX_PAGES,
        );
        return { data: rows, ttlSeconds };
      });
    },

    async getNflEventOdds(eventId: string): Promise<SharpApiRow[]> {
      return getOrSetCached(CACHE_STORE, `event:${eventId}`, async () => {
        const apiKey = requireApiKey();
        const { rows, ttlSeconds } = await fetchAllPages(
          `${BASE_URL}?league=nfl&event_id=${encodeURIComponent(eventId)}&sportsbook=draftkings,fanduel`,
          apiKey,
          EVENT_MAX_PAGES,
        );
        return { data: rows, ttlSeconds };
      });
    },
  };
}
