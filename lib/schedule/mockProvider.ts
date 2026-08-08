import type { ScheduleGame, ScheduleProvider } from "./types";

const GAMES: Record<string, ScheduleGame[]> = {
  NFL: [
    {
      id: "evt_broncos_chiefs",
      league: "NFL",
      commenceTime: "2026-08-09T20:25:00Z",
      homeTeam: "Denver Broncos",
      awayTeam: "Kansas City Chiefs",
    },
  ],
  NBA: [
    {
      id: "evt_lakers_celtics",
      league: "NBA",
      commenceTime: "2026-08-10T23:00:00Z",
      homeTeam: "Boston Celtics",
      awayTeam: "Los Angeles Lakers",
    },
  ],
  MLB: [
    {
      id: "evt_yankees_braves",
      league: "MLB",
      commenceTime: "2026-08-09T19:05:00Z",
      homeTeam: "New York Yankees",
      awayTeam: "Atlanta Braves",
    },
  ],
  // Deliberately empty -- mirrors the real off-season case (e.g. NHL in August) so the
  // "no games in this window" empty state gets exercised without needing live data.
  NHL: [],
};

// Deterministic, offline implementation for development/testing -- mirrors
// lib/rosters/mockProvider.ts's role for the roster layer.
export function createMockScheduleProvider(): ScheduleProvider {
  return {
    async listUpcomingGames(league: string): Promise<ScheduleGame[]> {
      return GAMES[league] ?? [];
    },
  };
}
