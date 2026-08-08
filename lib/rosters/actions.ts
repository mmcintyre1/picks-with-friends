"use server";

import { getRosterProvider } from "./index";
import { findTeamIdByName, LEAGUE_ESPN_PATHS } from "./leagues";
import { RosterProviderError, type RosterPlayer } from "./types";

// A roster player tagged with which side of the matchup they're on -- the underlying
// RosterProvider is keyed by ESPN team id and doesn't know team display names, so this
// tagging happens here, one level up, where both team names are already in scope.
export type GameRosterPlayer = RosterPlayer & { team: string };

function describeError(error: unknown): string {
  if (error instanceof RosterProviderError) {
    return error.kind === "not_found"
      ? "Couldn't find that team's roster."
      : "Roster lookup is temporarily unavailable.";
  }
  return "Couldn't load players.";
}

// Triggered automatically once both team names resolve to known teams in the parlay's
// league (see PickLegForm's effect) rather than behind a manual button -- safe to do
// eagerly because espnProvider.ts already caches each team's roster for 6 hours, so
// re-typing/re-picking the same matchup never re-hits the network.
export async function getRostersForGame(
  league: string,
  homeTeam: string,
  awayTeam: string,
): Promise<{ players: GameRosterPlayer[] } | { error: string }> {
  const sportPath = LEAGUE_ESPN_PATHS[league];
  if (!sportPath) return { error: `Player rosters aren't available for ${league}.` };

  const homeId = findTeamIdByName(league, homeTeam);
  const awayId = findTeamIdByName(league, awayTeam);
  if (!homeId && !awayId) {
    return { error: `Neither team name matches a known ${league} team — try picking from the list.` };
  }

  try {
    const provider = getRosterProvider();
    const [homeRoster, awayRoster] = await Promise.all([
      homeId ? provider.getRoster(sportPath, homeId) : Promise.resolve([]),
      awayId ? provider.getRoster(sportPath, awayId) : Promise.resolve([]),
    ]);
    const players: GameRosterPlayer[] = [
      ...homeRoster.map((p) => ({ ...p, team: homeTeam })),
      ...awayRoster.map((p) => ({ ...p, team: awayTeam })),
    ];
    return { players };
  } catch (error) {
    return { error: describeError(error) };
  }
}
