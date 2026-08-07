import { BOOKMAKER_PRIORITY } from "./mapping";
import { OddsProviderError } from "./types";
import type { OddsProvider, ProviderEvent, ProviderGame, ProviderProp, ProviderScore } from "./types";

const BASE_URL = "https://api.the-odds-api.com";
const EVENTS_REVALIDATE_SECONDS = 3600; // schedule barely changes -- cache it generously
const EVENT_ODDS_REVALIDATE_SECONDS = 300;

// The Odds API wants whole-second ISO timestamps (no milliseconds) for commenceTimeFrom/To.
function toApiTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Process-local cache on top of (not instead of) Next's fetch-level `revalidate`. This
// exists because relying on Next's Data Cache alone let repeat calls slip through and
// cost real quota -- React Strict Mode double-invokes effects in dev (two near-
// simultaneous requests can both miss a cache that hasn't finished writing yet), and
// re-opening/reloading the same pick page kept re-fetching instead of reusing a recent
// result. A dumb in-memory TTL map closes that gap: identical requests within the
// window always return the cached value, no network call at all. It won't help across
// separate Vercel serverless instances in production, but Next's Data Cache is the
// backstop there -- this is specifically to stop a single dev session (or a single warm
// instance) from re-billing itself for the same question asked twice in a row.
const memoryCache = new Map<string, { expires: number; data: unknown }>();

// Test-only escape hatch -- this cache is module-level state, so without a way to reset
// it, one test's cached response would leak into the next test that happens to build an
// identical request URL.
export function __resetOddsCacheForTests() {
  memoryCache.clear();
}

async function request(path: string, params: Record<string, string>, revalidate: number): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const cacheKey = url.toString();

  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const res = await fetch(url, { next: { revalidate } });

  // Quota visibility is cheap and useful given the 500-credit/month free tier -- logged,
  // never thrown on, since a successful response shouldn't fail just because we're low.
  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");
  if (remaining !== null) {
    console.log(`[the-odds-api] ${used ?? "?"} used, ${remaining} remaining this month`);
  }

  if (res.ok) {
    const data = await res.json();
    memoryCache.set(cacheKey, { expires: Date.now() + revalidate * 1000, data });
    return data;
  }

  if (res.status === 401 || res.status === 403) {
    throw new OddsProviderError("upstream_error", `The Odds API rejected the request (${res.status}).`);
  }
  if (res.status === 429) {
    throw new OddsProviderError("quota_exceeded", "The Odds API monthly quota is exhausted.");
  }
  if (res.status === 404) {
    throw new OddsProviderError("not_found", "That game wasn't found.");
  }
  throw new OddsProviderError("upstream_error", `The Odds API returned ${res.status}.`);
}

export function createTheOddsApiProvider(apiKey: string): OddsProvider {
  if (!apiKey) {
    throw new OddsProviderError("missing_key", "ODDS_API_KEY is not set.");
  }

  return {
    async listEvents(sportKey, opts): Promise<ProviderEvent[]> {
      // No `markets` param -- this is the bare-schedule endpoint, which The Odds API
      // doesn't charge for (cost is markets x regions; zero markets requested = free).
      // This is what makes "browse the schedule for free, pay only for odds you click
      // into" possible.
      const params: Record<string, string> = { apiKey };
      if (opts?.commenceFrom) params.commenceTimeFrom = toApiTimestamp(opts.commenceFrom);
      if (opts?.commenceTo) params.commenceTimeTo = toApiTimestamp(opts.commenceTo);

      const raw = await request(`/v4/sports/${sportKey}/events/`, params, EVENTS_REVALIDATE_SECONDS);
      return (raw as RawEvent[]).map(mapRawEvent);
    },

    async getEventOdds(sportKey: string, eventId: string, markets: string[]): Promise<ProviderProp> {
      const raw = await request(
        `/v4/sports/${sportKey}/events/${eventId}/odds/`,
        {
          apiKey,
          regions: "us",
          markets: markets.join(","),
          oddsFormat: "american",
          bookmakers: BOOKMAKER_PRIORITY.join(","),
        },
        EVENT_ODDS_REVALIDATE_SECONDS,
      );
      return mapRawGame(raw as RawGame);
    },

    async getScores(sportKey: string, opts: { daysFrom: number }): Promise<ProviderScore[]> {
      const raw = await request(
        `/v4/sports/${sportKey}/scores/`,
        { apiKey, daysFrom: String(opts.daysFrom) },
        60,
      );
      return (raw as RawScore[]).map((s) => ({
        id: s.id,
        homeTeam: s.home_team,
        awayTeam: s.away_team,
        completed: s.completed,
        homeScore: s.scores?.find((sc) => sc.name === s.home_team)?.score ?? null,
        awayScore: s.scores?.find((sc) => sc.name === s.away_team)?.score ?? null,
      }));
    },
  };
}

// Raw response shapes from The Odds API (snake_case, as documented) -- mapped to this
// app's camelCase ProviderGame/ProviderScore immediately, so nothing downstream of this
// file ever sees the vendor's wire format.
type RawOutcome = { name: string; price: number; point?: number; description?: string };
type RawMarket = { key: string; last_update: string; outcomes: RawOutcome[] };
type RawBookmaker = { key: string; title: string; last_update: string; markets: RawMarket[] };
type RawGame = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: RawBookmaker[];
};
type RawScore = {
  id: string;
  home_team: string;
  away_team: string;
  completed: boolean;
  scores: { name: string; score: number }[] | null;
};
// The bare /events response -- same identifying fields as RawGame, just no bookmakers.
type RawEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

function mapRawEvent(raw: RawEvent): ProviderEvent {
  return {
    id: raw.id,
    sportKey: raw.sport_key,
    commenceTime: raw.commence_time,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
  };
}

function mapRawGame(raw: RawGame): ProviderGame {
  return {
    id: raw.id,
    sportKey: raw.sport_key,
    sportTitle: raw.sport_title,
    commenceTime: raw.commence_time,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
    bookmakers: raw.bookmakers.map((b) => ({
      key: b.key,
      title: b.title,
      lastUpdate: b.last_update,
      markets: b.markets.map((m) => ({
        key: m.key,
        lastUpdate: m.last_update,
        outcomes: m.outcomes,
      })),
    })),
  };
}
