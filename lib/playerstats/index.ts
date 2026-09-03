import { createEspnPlayerStatsProvider } from "./espnProvider";
import { createMockPlayerStatsProvider } from "./mockProvider";
import type { PlayerStatsProvider } from "./types";

let cached: PlayerStatsProvider | undefined;

// Defaults to the REAL ESPN provider, not mock -- same call this app's roster layer makes
// (lib/rosters/index.ts's own comment explains the reasoning): this endpoint is free, needs
// no key, and has no quota, so there's nothing to protect by defaulting to fixtures, and
// defaulting to real means hit rates actually work in local dev without any env setup.
// Set PLAYERSTATS_PROVIDER=mock to force the offline fixtures.
export function getPlayerStatsProvider(): PlayerStatsProvider {
  if (cached) return cached;
  cached = process.env.PLAYERSTATS_PROVIDER === "mock" ? createMockPlayerStatsProvider() : createEspnPlayerStatsProvider();
  return cached;
}
