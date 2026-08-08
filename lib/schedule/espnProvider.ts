import { LEAGUE_ESPN_PATHS } from "@/lib/rosters/leagues";

import { ScheduleProviderError } from "./types";
import type { ScheduleGame, ScheduleProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
// Schedules barely change -- cache generously, same reasoning as lib/odds/theOddsApiProvider.ts's
// EVENTS_REVALIDATE_SECONDS.
const SCHEDULE_REVALIDATE_SECONDS = 60 * 60;

// Process-local TTL cache on top of Next's fetch-level `revalidate`, same pattern as
// lib/rosters/espnProvider.ts's memoryCache.
const memoryCache = new Map<string, { expires: number; data: ScheduleGame[] }>();

export function __resetScheduleCacheForTests() {
  memoryCache.clear();
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

type RawCompetitor = { homeAway: "home" | "away"; team: { displayName: string } };
type RawEvent = { id: string; date: string; competitions: { competitors: RawCompetitor[] }[] };
type RawScoreboardResponse = { events: RawEvent[] };

function mapRawEvent(raw: RawEvent, league: string): ScheduleGame | null {
  const competitors = raw.competitions[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;
  return {
    id: raw.id,
    league,
    commenceTime: raw.date,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
  };
}

// ESPN's free, no-key, undocumented scoreboard endpoint -- schedule only, no betting
// lines. Verified: GET .../sports/{sportPath}/scoreboard?dates=YYYYMMDD-YYYYMMDD.
export function createEspnScheduleProvider(): ScheduleProvider {
  return {
    async listUpcomingGames(league: string, opts): Promise<ScheduleGame[]> {
      const sportPath = LEAGUE_ESPN_PATHS[league];
      if (!sportPath) return [];

      const params = new URLSearchParams();
      if (opts?.commenceFrom && opts?.commenceTo) {
        params.set("dates", `${toDateParam(opts.commenceFrom)}-${toDateParam(opts.commenceTo)}`);
      }
      const url = `${BASE_URL}/${sportPath}/scoreboard?${params.toString()}`;

      const cached = memoryCache.get(url);
      if (cached && cached.expires > Date.now()) return cached.data;

      const res = await fetch(url, { next: { revalidate: SCHEDULE_REVALIDATE_SECONDS } });
      if (!res.ok) {
        throw new ScheduleProviderError("upstream_error", `ESPN returned ${res.status}.`);
      }

      const raw = (await res.json()) as RawScoreboardResponse;
      const games = raw.events.map((e) => mapRawEvent(e, league)).filter((g): g is ScheduleGame => g !== null);

      memoryCache.set(url, { expires: Date.now() + SCHEDULE_REVALIDATE_SECONDS * 1000, data: games });
      return games;
    },
  };
}
