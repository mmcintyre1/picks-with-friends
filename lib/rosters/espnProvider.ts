import { RosterProviderError } from "./types";
import type { RosterPlayer, RosterProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
// Rosters barely change week to week -- cache generously, same reasoning as
// EVENTS_REVALIDATE_SECONDS in lib/odds/theOddsApiProvider.ts.
const ROSTER_REVALIDATE_SECONDS = 6 * 60 * 60;

// Process-local TTL cache on top of Next's fetch-level `revalidate`, same pattern (and
// same reasoning) as lib/odds/theOddsApiProvider.ts's memoryCache. Keyed by sport+team
// since the same numeric team id can collide across leagues (e.g. NFL team "1" and NBA
// team "1" are unrelated teams).
const memoryCache = new Map<string, { expires: number; data: RosterPlayer[] }>();

export function __resetRosterCacheForTests() {
  memoryCache.clear();
}

type RawPlayer = { displayName: string; position?: { abbreviation?: string } };
// NFL/MLB/NHL group players under position categories (`{ items: [...] }`); NBA's roster
// endpoint returns a flat array of players directly, no grouping at all. Both are handled
// by treating an entry either as a group (if it has `.items`) or as a player itself.
type RawRosterGroup = RawPlayer & { items?: RawPlayer[] };
type RawRosterResponse = { athletes: RawRosterGroup[] };

function toPlayer(raw: RawPlayer): RosterPlayer {
  return { name: raw.displayName, position: raw.position?.abbreviation ?? "" };
}

// ESPN's free, no-key, undocumented site API -- see lib/rosters/leagues.ts for the
// verified per-league endpoints. Unofficial (no published SLA), but free and widely
// relied upon.
export function createEspnProvider(): RosterProvider {
  return {
    async getRoster(sportPath: string, teamId: string): Promise<RosterPlayer[]> {
      const cacheKey = `${sportPath}:${teamId}`;
      const cached = memoryCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return cached.data;

      const res = await fetch(`${BASE_URL}/${sportPath}/teams/${teamId}/roster`, {
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
      // squad, or NBA's ungrouped flat list) -- the whole point of this provider is
      // surfacing bench players a sportsbook's props never bother pricing, not just the
      // featured names.
      const players = raw.athletes.flatMap((group) =>
        Array.isArray(group.items) ? group.items.map(toPlayer) : [toPlayer(group)],
      );

      memoryCache.set(cacheKey, { expires: Date.now() + ROSTER_REVALIDATE_SECONDS * 1000, data: players });
      return players;
    },
  };
}
