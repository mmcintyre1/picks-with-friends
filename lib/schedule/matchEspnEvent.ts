import { LEAGUE_ESPN_PATHS } from "@/lib/rosters/leagues";
import { teamNamesMatch } from "@/lib/teamNamesMatch";

import { getScheduleProvider } from "./index";

// How far back/forward of `searchAround` to look for a matching game on ESPN's free
// schedule endpoint. 3 days back / 1 day forward was tuned for app/parlays/actions.ts's
// original use (evaluating a parlay shortly after it locks/resolves); a game found via
// research browsing can be searched around its own real commenceTime instead, which is
// exactly why this window is a parameter rather than always defaulting to "now".
const DAYS_BACK = 3;
const DAYS_FORWARD = 1;

// Resolves a real ESPN event id for a team-name pair, searching a window around
// `searchAround` rather than always "now" -- generalized out of app/parlays/actions.ts's
// original evaluateParlay-specific matcher so a second caller (lib/trends/, which resolves
// a research-browsed game that might be days from kickoff) can reuse the exact same
// team-name-matching logic instead of a second, near-duplicate implementation. Pure lookup
// only -- callers own writing the resolved id back to whichever table they're caching it on
// (Game.espnEventId vs TrackedGame.espnEventId), since that's caller-specific.
export async function matchEspnEvent(
  league: string | null,
  homeTeam: string,
  awayTeam: string,
  searchAround: Date,
): Promise<string | null> {
  if (!league || !(league in LEAGUE_ESPN_PATHS)) return null;

  const commenceFrom = new Date(searchAround.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);
  const commenceTo = new Date(searchAround.getTime() + DAYS_FORWARD * 24 * 60 * 60 * 1000);

  const scheduled = await getScheduleProvider().listUpcomingGames(league, { commenceFrom, commenceTo });
  const match = scheduled.find(
    (g) =>
      (teamNamesMatch(g.homeTeam, homeTeam) && teamNamesMatch(g.awayTeam, awayTeam)) ||
      (teamNamesMatch(g.homeTeam, awayTeam) && teamNamesMatch(g.awayTeam, homeTeam)),
  );
  return match?.id ?? null;
}
