import { getOrSetCached } from "@/lib/research/durableCache";

import { SportsGameOddsProviderError } from "./types";
import type { SportsGameOddsEvent, SportsGameOddsProvider, SportsGameOddsResponse } from "./types";

const BASE_URL = "https://api.sportsgameodds.com/v2/events/";
// This vendor's real binding constraint is a MONTHLY entity budget (2,500/month on the free
// "amateur" tier, confirmed via a real GET /account/usage/ call), not a per-minute rate --
// unlike SharpAPI, where a short TTL matters because its 12-req/min limit resets every
// minute. A short TTL does nothing to protect a monthly budget; what actually protects it
// is a long TTL, since the cost that matters is cumulative real upstream calls over weeks,
// not freshness within any given minute. 15 minutes is a deliberate choice for a friend-
// group pick tool, not a live-trading one -- pre-game lines don't need to be minute-fresh,
// and this is a ~10x reduction in real upstream calls versus the previous flat 90s TTL
// (which was borrowed from SharpAPI's own policy without re-deriving it for this vendor's
// actually-different constraint). Backed by the durable cache (see lib/research/
// durableCache.ts) so this TTL actually holds across serverless cold starts, not just for
// one warm instance's lifetime -- a long in-memory-only TTL would be meaningless if a
// fresh instance re-fetches on every request anyway.
const DEFAULT_TTL_SECONDS = 15 * 60;
const CACHE_STORE = "sportsgameodds";
// Matches SharpAPI's own 2-book convention (draftkings + fanduel) for consistent per-
// selection book attribution across both providers.
const BOOKMAKERS = "draftkings,fanduel";

async function fetchEvents(url: string, apiKey: string): Promise<SportsGameOddsEvent[]> {
  const res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  if (res.status === 429) {
    throw new SportsGameOddsProviderError("rate_limited", "SportsGameOdds rate limit reached.");
  }
  if (!res.ok) {
    throw new SportsGameOddsProviderError("upstream_error", `SportsGameOdds returned ${res.status}.`);
  }
  const json: SportsGameOddsResponse = await res.json();
  if (!json.success) {
    throw new SportsGameOddsProviderError("upstream_error", "SportsGameOdds reported an unsuccessful response.");
  }
  return json.data;
}

function requireApiKey(): string {
  const apiKey = process.env.SPORTS_GAME_ODDS_API_KEY;
  if (!apiKey) {
    throw new SportsGameOddsProviderError("missing_key", "SPORTS_GAME_ODDS_API_KEY is not set.");
  }
  return apiKey;
}

// Real, live implementation -- confirmed against SportsGameOdds' actual free-tier "amateur"
// responses during Phase 2.19 planning/implementation. Two entry points mirroring
// lib/sharpapi/sharpApiProvider.ts's exact shape: a schedule discovery call and a per-event
// full-board call, so the fallback orchestration in lib/research/actions.ts can treat both
// vendors identically.
export function createSportsGameOddsProvider(): SportsGameOddsProvider {
  return {
    async listNflSchedule(): Promise<SportsGameOddsEvent[]> {
      return getOrSetCached(CACHE_STORE, "schedule", async () => {
        const apiKey = requireApiKey();
        const data = await fetchEvents(`${BASE_URL}?leagueID=NFL&oddsAvailable=true&bookmakerID=${BOOKMAKERS}&limit=25`, apiKey);
        return { data, ttlSeconds: DEFAULT_TTL_SECONDS };
      });
    },

    async getNflEventOdds(eventId: string): Promise<SportsGameOddsEvent | null> {
      return getOrSetCached(CACHE_STORE, `event:${eventId}`, async () => {
        const apiKey = requireApiKey();
        const events = await fetchEvents(
          `${BASE_URL}?eventID=${encodeURIComponent(eventId)}&bookmakerID=${BOOKMAKERS}&includeAltLines=true&oddsAvailable=true`,
          apiKey,
        );
        return { data: events[0] ?? null, ttlSeconds: DEFAULT_TTL_SECONDS };
      });
    },
  };
}
