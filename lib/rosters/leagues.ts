import { MLB_TEAMS } from "./mlbTeams";
import { NBA_TEAMS } from "./nbaTeams";
import { NFL_TEAMS } from "./nflTeams";
import { NHL_TEAMS } from "./nhlTeams";

// The ESPN site-API sport path segment per league -- e.g. GET .../apis/site/v2/sports/{path}/teams.
export const LEAGUE_ESPN_PATHS: Record<string, string> = {
  NFL: "football/nfl",
  NBA: "basketball/nba",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
};

export const LEAGUE_TEAMS: Record<string, { id: string; name: string }[]> = {
  NFL: NFL_TEAMS,
  NBA: NBA_TEAMS,
  MLB: MLB_TEAMS,
  NHL: NHL_TEAMS,
};

// Roster/player-prop autofill (Phase 2.6/2.8) covers these four leagues; live odds
// (lib/odds/) covers NFL only -- the two are intentionally decoupled, see PickLegForm.
export function isRosterLeague(league: string): boolean {
  return league in LEAGUE_ESPN_PATHS;
}

// Every league offered in PickLegForm's per-pick Sport selector -- every parlay uses the
// same pick flow now regardless of label, so this is just "all roster-backed leagues."
export const PICKABLE_LEAGUES = Object.keys(LEAGUE_ESPN_PATHS);

export function findTeamIdByName(league: string, name: string): string | undefined {
  const teams = LEAGUE_TEAMS[league];
  if (!teams) return undefined;
  const needle = name.trim().toLowerCase();
  return teams.find((t) => t.name.toLowerCase() === needle)?.id;
}
