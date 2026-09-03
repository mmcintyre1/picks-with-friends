import { PlayerStatsProviderError } from "./types";
import type { EspnGameLogResponse, PlayerStatsProvider } from "./types";

// Note the host: the game-log endpoint lives on site.web.api.espn.com, NOT the
// site.api.espn.com that lib/rosters/ and lib/schedule/ use -- confirmed by real call, they
// are genuinely different hosts for different ESPN API families.
const BASE_URL = "https://site.web.api.espn.com/apis/common/v3/sports";
// A game log only changes when the player plays another game -- weekly at most for NFL. Same
// 6-hour TTL (and same reasoning) as lib/rosters/espnProvider.ts's roster cache.
const GAMELOG_REVALIDATE_SECONDS = 6 * 60 * 60;

// Plain in-memory cache rather than lib/research/durableCache.ts's Blobs-backed one: that
// exists to protect metered vendors' monthly budgets, and this is free, unmetered ESPN data
// -- so this matches its sibling ESPN providers (rosters/schedule/evaluate), which all cache
// in memory only.
const memoryCache = new Map<string, { expires: number; data: EspnGameLogResponse }>();

export function __resetGameLogCacheForTests() {
  memoryCache.clear();
}

export function createEspnPlayerStatsProvider(): PlayerStatsProvider {
  return {
    async getGameLog(sportPath: string, athleteId: string): Promise<EspnGameLogResponse> {
      const cacheKey = `${sportPath}:${athleteId}`;
      const cached = memoryCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return cached.data;

      const res = await fetch(`${BASE_URL}/${sportPath}/athletes/${athleteId}/gamelog`, {
        next: { revalidate: GAMELOG_REVALIDATE_SECONDS },
      });

      if (res.status === 404) {
        throw new PlayerStatsProviderError("not_found", "That player's game log wasn't found.");
      }
      if (!res.ok) {
        throw new PlayerStatsProviderError("upstream_error", `ESPN returned ${res.status}.`);
      }

      const data = (await res.json()) as EspnGameLogResponse;
      memoryCache.set(cacheKey, { expires: Date.now() + GAMELOG_REVALIDATE_SECONDS * 1000, data });
      return data;
    },
  };
}
