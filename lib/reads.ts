import { getPlayerPropLogs } from "@/lib/playerstats/actions";
import { getNflGameOdds, getNflSchedule, getNflScheduleGameLines } from "@/lib/research/actions";
import { getRostersForGame } from "@/lib/rosters/actions";
import { getScheduleGames } from "@/lib/schedule/actions";
import { getTeamTrend } from "@/lib/trends/actions";

// Read-only lookups the pick flow and research page make, served over a plain route
// (app/api/read/[fn]) instead of being called as server actions. Next.js runs a page's
// server actions one at a time, so a slow vendor lookup (several seconds when the odds APIs
// are cold) used to queue a user's own "Confirm pick"/"Lock" behind it -- which read as the
// button not working. Fetches through the route run in parallel and never block actions.
export const READS = {
  getNflSchedule,
  getNflScheduleGameLines,
  getNflGameOdds,
  getRostersForGame,
  getPlayerPropLogs,
  getScheduleGames,
  getTeamTrend,
};

export type Reads = typeof READS;
export type ReadName = keyof Reads;
