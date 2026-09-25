"use server";

import { getScheduleProvider } from "./index";
import { ScheduleProviderError, type ScheduleGame } from "./types";

// Bounds the fetch to roughly the next week, same reasoning as lib/odds/actions.ts's
// UPCOMING_WINDOW_DAYS -- without it a full-season endpoint would return far too much.
const UPCOMING_WINDOW_DAYS = 8;

function describeError(error: unknown): string {
  if (error instanceof ScheduleProviderError) return "Schedule lookup is temporarily unavailable.";
  return "Couldn't load the schedule.";
}

// Named distinctly from lib/odds/actions.ts's getUpcomingGames -- same idea (a free
// schedule browse), different provider (ESPN, no odds/lines), covering every pickable
// league (see PICKABLE_LEAGUES), not just NFL.
export async function getScheduleGames(league: string): Promise<{ games: ScheduleGame[] } | { error: string }> {
  const commenceFrom = new Date();
  const commenceTo = new Date(commenceFrom.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    const scheduled = await getScheduleProvider().listUpcomingGames(league, { commenceFrom, commenceTo });
    // The provider returns whole days (it has to fetch them one at a time), including games
    // that already kicked off earlier today -- nothing left to pick a pregame leg on there.
    const now = Date.now();
    const games = scheduled.filter((g) => new Date(g.commenceTime).getTime() > now);
    return { games };
  } catch (error) {
    return { error: describeError(error) };
  }
}
