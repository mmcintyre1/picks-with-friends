import { RosterProviderError } from "./types";
import type { RosterPlayer, RosterProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
// Rosters barely change week to week -- cache generously, same reasoning as
// EVENTS_REVALIDATE_SECONDS in lib/odds/theOddsApiProvider.ts.
const ROSTER_REVALIDATE_SECONDS = 6 * 60 * 60;

// Process-local TTL cache on top of Next's fetch-level `revalidate`, same pattern (and
// same reasoning) as lib/odds/theOddsApiProvider.ts's memoryCache.
const memoryCache = new Map<string, { expires: number; data: RosterPlayer[] }>();

export function __resetRosterCacheForTests() {
  memoryCache.clear();
}

type RawRosterResponse = {
  athletes: { items: { displayName: string; position?: { abbreviation?: string } }[] }[];
};

// ESPN's free, no-key, undocumented site API -- see lib/rosters/nflTeams.ts for the
// verified endpoints. Unofficial (no published SLA), but free and widely relied upon.
export function createEspnProvider(): RosterProvider {
  return {
    async getRoster(teamId: string): Promise<RosterPlayer[]> {
      const cacheKey = teamId;
      const cached = memoryCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return cached.data;

      const res = await fetch(`${BASE_URL}/teams/${teamId}/roster`, {
        next: { revalidate: ROSTER_REVALIDATE_SECONDS },
      });

      if (res.status === 404) {
        throw new RosterProviderError("not_found", "That team's roster wasn't found.");
      }
      if (!res.ok) {
        throw new RosterProviderError("upstream_error", `ESPN returned ${res.status}.`);
      }

      const raw = (await res.json()) as RawRosterResponse;
      // Flatten every group (offense/defense/special-teams/injured/suspended/practice
      // squad) -- the whole point of this provider is surfacing bench players a
      // sportsbook's props never bother pricing, not just the featured names.
      const players = raw.athletes.flatMap((group) =>
        group.items.map((item) => ({
          name: item.displayName,
          position: item.position?.abbreviation ?? "",
        })),
      );

      memoryCache.set(cacheKey, { expires: Date.now() + ROSTER_REVALIDATE_SECONDS * 1000, data: players });
      return players;
    },
  };
}
