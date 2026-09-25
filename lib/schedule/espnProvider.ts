import { LEAGUE_ESPN_PATHS } from "@/lib/rosters/leagues";

import { ScheduleProviderError } from "./types";
import type { ScheduleGame, ScheduleProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
// Schedules barely change -- cache generously, same reasoning as lib/odds/theOddsApiProvider.ts's
// EVENTS_REVALIDATE_SECONDS.
const SCHEDULE_REVALIDATE_SECONDS = 60 * 60;
// Upper bound on how many single-day requests one call can fan out to, so a caller passing an
// absurd range can't turn into dozens of upstream requests.
const MAX_DAYS = 14;

// Process-local TTL cache on top of Next's fetch-level `revalidate`, same pattern as
// lib/rosters/espnProvider.ts's memoryCache. Keyed per request URL, i.e. per league per day.
const memoryCache = new Map<string, { expires: number; data: ScheduleGame[] }>();

export function __resetScheduleCacheForTests() {
  memoryCache.clear();
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// Every whole UTC day from one day BEFORE `from` through `to`. The extra leading day is
// deliberate: ESPN reads a `dates=YYYYMMDD` value as a US Eastern calendar day, which trails
// UTC, so a game still upcoming this evening (Eastern) can already be "tomorrow" in UTC.
function daysToFetch(from: Date, to: Date): string[] {
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - 1));
  const last = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const days: string[] = [];
  while (cursor.getTime() <= last && days.length < MAX_DAYS) {
    days.push(toDateParam(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
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

async function fetchScoreboard(url: string, league: string): Promise<ScheduleGame[]> {
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
}

// ESPN's free, no-key, undocumented scoreboard endpoint -- schedule only, no betting lines.
// Verified: GET .../sports/{sportPath}/scoreboard?dates=YYYYMMDD returns that one day's games.
// A `dates=YYYYMMDD-YYYYMMDD` RANGE used to work but now returns a 400 for every range (re-checked
// live for all four leagues), so a window is fetched as one request per day instead, in
// parallel, and merged. One day failing doesn't lose the rest; only every day failing throws.
export function createEspnScheduleProvider(): ScheduleProvider {
  return {
    async listUpcomingGames(league: string, opts): Promise<ScheduleGame[]> {
      const sportPath = LEAGUE_ESPN_PATHS[league];
      if (!sportPath) return [];

      const urls =
        opts?.commenceFrom && opts?.commenceTo
          ? daysToFetch(opts.commenceFrom, opts.commenceTo).map((day) => `${BASE_URL}/${sportPath}/scoreboard?dates=${day}`)
          : [`${BASE_URL}/${sportPath}/scoreboard`];

      const results = await Promise.allSettled(urls.map((url) => fetchScoreboard(url, league)));
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed.length === results.length) throw failed[0].reason;

      const byId = new Map<string, ScheduleGame>();
      for (const result of results) {
        if (result.status === "fulfilled") for (const game of result.value) byId.set(game.id, game);
      }
      return [...byId.values()].sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
    },
  };
}
