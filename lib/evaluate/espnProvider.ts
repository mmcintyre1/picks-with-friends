import { BoxScoreProviderError } from "./types";
import type { BoxScore, BoxScoreProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
// Live games change constantly -- far shorter than lib/rosters/lib/schedule's hours-long
// TTLs. Once a game is FINAL its box score never changes again, so that state gets cached
// effectively forever instead of ever being re-fetched.
const LIVE_REVALIDATE_SECONDS = 30;
const FINAL_REVALIDATE_SECONDS = 24 * 60 * 60;

// Process-local TTL cache on top of Next's fetch-level `revalidate`, same pattern as
// lib/rosters/espnProvider.ts and lib/schedule/espnProvider.ts. Keyed by sport+event since
// this is what actually bounds ESPN traffic no matter how often "Evaluate" gets clicked --
// see evaluateParlay's separate per-parlay cooldown for the click-spam guard itself.
const memoryCache = new Map<string, { expires: number; data: BoxScore }>();

export function __resetBoxScoreCacheForTests() {
  memoryCache.clear();
}

type RawStatus = { state: "pre" | "in" | "post"; completed: boolean; detail: string };
type RawCompetitor = { homeAway: "home" | "away"; score?: string };
type RawHeader = { competitions: { status: { type: RawStatus }; competitors: RawCompetitor[] }[] };
// NFL's stat groups key their group name as `name`; MLB's as `type` -- both read defensively.
type RawStatGroup = {
  name?: string;
  type?: string;
  keys: string[];
  athletes: { athlete: { displayName: string }; stats: string[] }[];
};
type RawPlayerTeam = { statistics: RawStatGroup[] };
type RawSummary = { header: RawHeader; boxscore?: { players?: RawPlayerTeam[] } };

function parseScore(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function flattenPlayerStats(players: RawPlayerTeam[] | undefined): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();
  for (const team of players ?? []) {
    for (const group of team.statistics) {
      const groupName = group.name ?? group.type ?? "unknown";
      for (const entry of group.athletes) {
        const nameKey = entry.athlete.displayName.toLowerCase();
        const statMap = result.get(nameKey) ?? new Map<string, string>();
        group.keys.forEach((key, i) => statMap.set(`${groupName}.${key}`, entry.stats[i]));
        result.set(nameKey, statMap);
      }
    }
  }
  return result;
}

// ESPN's free, no-key, undocumented site API -- verified: GET
// .../sports/{sportPath}/summary?event={eventId}. `header.competitions[0].status.type`
// gives clean pre/in/post state; `boxscore.players[].statistics[]` exposes LIVE mid-game
// player stat totals, not just final ones, which is what makes early grading possible.
export function createEspnBoxScoreProvider(): BoxScoreProvider {
  return {
    async getBoxScore(sportPath: string, eventId: string): Promise<BoxScore> {
      const cacheKey = `${sportPath}:${eventId}`;
      const cached = memoryCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return cached.data;

      const res = await fetch(`${BASE_URL}/${sportPath}/summary?event=${eventId}`, {
        next: { revalidate: LIVE_REVALIDATE_SECONDS },
      });
      if (res.status === 404) {
        throw new BoxScoreProviderError("not_found", "That game wasn't found.");
      }
      if (!res.ok) {
        throw new BoxScoreProviderError("upstream_error", `ESPN returned ${res.status}.`);
      }

      const raw = (await res.json()) as RawSummary;
      const competition = raw.header.competitions[0];
      const status = competition.status.type;
      const home = competition.competitors.find((c) => c.homeAway === "home");
      const away = competition.competitors.find((c) => c.homeAway === "away");

      const data: BoxScore = {
        status: { state: status.state, completed: status.completed, detail: status.detail },
        homeScore: parseScore(home?.score),
        awayScore: parseScore(away?.score),
        playerStats: flattenPlayerStats(raw.boxscore?.players),
      };

      const ttl = status.completed ? FINAL_REVALIDATE_SECONDS : LIVE_REVALIDATE_SECONDS;
      memoryCache.set(cacheKey, { expires: Date.now() + ttl * 1000, data });
      return data;
    },
  };
}
