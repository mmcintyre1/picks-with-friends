import { getOrSetCached } from "@/lib/research/durableCache";

import { ParlayApiProviderError } from "./types";
import type { ParlayApiEvent, ParlayApiEventData, ParlayApiGameOdds, ParlayApiProp, ParlayApiProvider } from "./types";

const BASE_URL = "https://parlay-api.com/v1";
const SPORT_KEY = "americanfootball_nfl";
const CACHE_STORE = "parlayapi";
// ParlayAPI's real binding constraint is a MONTHLY credit budget (1,000/month on the free
// tier, no credit card required -- confirmed via a real GET /account usage header check),
// not a per-minute rate (their documented "app-safety ceiling" is 10,000 req/sec, effectively
// unlimited for this app's real usage). Same reasoning as SportsGameOdds' cache policy: a
// long TTL is the real lever here, not freshness. 15 minutes matches the exact policy already
// used for SportsGameOdds -- see lib/sportsgameodds/sportsGameOddsProvider.ts's own comment
// for the full derivation, which applies unchanged to this vendor's identical constraint
// shape.
const DEFAULT_TTL_SECONDS = 15 * 60;
// Real sportsbooks with genuine American odds only -- deliberately excludes exchanges
// (novig) and DFS-style fixed-payout apps (sleeper, fliff) confirmed present in this
// vendor's broader book list, since their pricing doesn't behave like a normal sportsbook's
// and this app's payout math assumes real American odds throughout.
const BOOKMAKERS = "draftkings,fanduel,betmgm,caesars";

async function parlayApiFetch<T>(path: string): Promise<T> {
  const apiKey = requireApiKey();
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "X-API-Key": apiKey } });
  if (res.status === 429) {
    throw new ParlayApiProviderError("rate_limited", "ParlayAPI rate limit reached.");
  }
  if (!res.ok) {
    throw new ParlayApiProviderError("upstream_error", `ParlayAPI returned ${res.status}.`);
  }
  return res.json();
}

function requireApiKey(): string {
  const apiKey = process.env.PARLAY_API_KEY;
  if (!apiKey) {
    throw new ParlayApiProviderError("missing_key", "PARLAY_API_KEY is not set.");
  }
  return apiKey.trim();
}

// Real, live implementation -- confirmed against ParlayAPI's actual free-tier responses
// during this session's integration work. Three real endpoints: a free schedule-discovery
// call, and two per-event calls (odds + props) merged into one ParlayApiEventData, mirroring
// every other provider's single getNflEventOdds entry point from the caller's perspective.
export function createParlayApiProvider(): ParlayApiProvider {
  return {
    async listNflSchedule(): Promise<ParlayApiEvent[]> {
      return getOrSetCached(CACHE_STORE, "schedule", async () => {
        const data = await parlayApiFetch<ParlayApiEvent[]>(`/sports/${SPORT_KEY}/events`);
        return { data, ttlSeconds: DEFAULT_TTL_SECONDS };
      });
    },

    async getNflEventOdds(eventId: string): Promise<ParlayApiEventData | null> {
      return getOrSetCached(CACHE_STORE, `event:${eventId}`, async () => {
        const [oddsList, props] = await Promise.all([
          parlayApiFetch<ParlayApiGameOdds[]>(
            `/sports/${SPORT_KEY}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=${BOOKMAKERS}&eventIds=${encodeURIComponent(eventId)}`,
          ),
          parlayApiFetch<ParlayApiProp[]>(
            `/sports/${SPORT_KEY}/props?eventId=${encodeURIComponent(eventId)}&bookmakers=${BOOKMAKERS}`,
          ),
        ]);

        const odds = oddsList[0] ?? null;
        const identity = odds ?? props[0];
        if (!identity) return { data: null, ttlSeconds: DEFAULT_TTL_SECONDS };

        const data: ParlayApiEventData = {
          homeTeam: identity.home_team,
          awayTeam: identity.away_team,
          commenceTime: identity.commence_time,
          odds,
          props,
        };
        return { data, ttlSeconds: DEFAULT_TTL_SECONDS };
      });
    },
  };
}
