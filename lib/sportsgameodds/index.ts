import { createMockSportsGameOddsProvider } from "./mockProvider";
import { createSportsGameOddsProvider } from "./sportsGameOddsProvider";
import type { SportsGameOddsProvider } from "./types";

let cached: SportsGameOddsProvider | undefined;

// Defaults to mock, matching every other real-vendor provider's convention in this app.
// Set SPORTSGAMEODDS_PROVIDER=sportsgameodds to use the real vendor (needs
// SPORTS_GAME_ODDS_API_KEY).
export function getSportsGameOddsProvider(): SportsGameOddsProvider {
  if (cached) return cached;
  cached =
    process.env.SPORTSGAMEODDS_PROVIDER === "sportsgameodds"
      ? createSportsGameOddsProvider()
      : createMockSportsGameOddsProvider();
  return cached;
}
