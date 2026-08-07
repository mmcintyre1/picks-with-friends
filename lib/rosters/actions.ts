"use server";

import { getRosterProvider } from "./index";
import { findTeamIdByName } from "./nflTeams";
import { RosterProviderError, type RosterPlayer } from "./types";

function describeError(error: unknown): string {
  if (error instanceof RosterProviderError) {
    return error.kind === "not_found"
      ? "Couldn't find that team's roster."
      : "Roster lookup is temporarily unavailable.";
  }
  return "Couldn't load players.";
}

// User-initiated only (a "Load players" button in PickLegForm), never auto-fetched on
// keystroke -- same "don't call an API for free" discipline as lib/odds/actions.ts.
export async function getRostersForGame(
  homeTeam: string,
  awayTeam: string,
): Promise<{ players: RosterPlayer[] } | { error: string }> {
  const homeId = findTeamIdByName(homeTeam);
  const awayId = findTeamIdByName(awayTeam);
  if (!homeId && !awayId) {
    return { error: "Neither team name matches a known NFL team -- try picking from the list." };
  }

  try {
    const provider = getRosterProvider();
    const [homeRoster, awayRoster] = await Promise.all([
      homeId ? provider.getRoster(homeId) : Promise.resolve([]),
      awayId ? provider.getRoster(awayId) : Promise.resolve([]),
    ]);
    return { players: [...homeRoster, ...awayRoster] };
  } catch (error) {
    return { error: describeError(error) };
  }
}
