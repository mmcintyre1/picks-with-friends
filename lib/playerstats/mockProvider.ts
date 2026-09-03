import type { EspnGameLogResponse, PlayerStatsProvider } from "./types";

// Fixtures shaped exactly like real captured game-log responses (positional `stats` aligned
// to a flat `names` array, an `events` map holding each game's real metadata) -- the two
// entries below mirror the two real positions actually confirmed this phase: a WR log
// (receiving + rushing columns) and a QB log (passing + rushing columns).
function makeResponse(names: string[], games: { eventId: string; date: string; opp: string; atVs: string; stats: string[] }[]): EspnGameLogResponse {
  return {
    names,
    labels: names,
    events: Object.fromEntries(
      games.map((g) => [g.eventId, { id: g.eventId, gameDate: g.date, atVs: g.atVs, opponent: { abbreviation: g.opp } }]),
    ),
    seasonTypes: [
      {
        displayName: "2025 Regular Season",
        categories: [{ events: games.map((g) => ({ eventId: g.eventId, stats: g.stats })) }],
      },
    ],
  };
}

const WR_NAMES = ["receptions", "receivingTargets", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception", "rushingAttempts", "rushingYards", "yardsPerRushAttempt", "longRushing", "rushingTouchdowns"];
const QB_NAMES = ["completions", "passingAttempts", "passingYards", "completionPct", "yardsPerPassAttempt", "passingTouchdowns", "interceptions", "longPassing", "sacks", "QBRating", "adjQBR", "rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"];

// Values chosen so the fixture exercises real, visibly different hit rates rather than all
// hits or all misses -- e.g. the WR below clears 60.5 receiving yards in 4 of 6 games.
const GAME_LOGS: Record<string, EspnGameLogResponse> = {
  // A.J. Brown (WR) -- real athlete id from the roster endpoint.
  "football/nfl:4047646": makeResponse(WR_NAMES, [
    { eventId: "e6", date: "2025-12-28T21:25:00.000+00:00", opp: "BUF", atVs: "@", stats: ["4", "7", "68", "17.0", "1", "30", "0", "0", "0.0", "0", "0"] },
    { eventId: "e5", date: "2025-12-20T22:00:00.000+00:00", opp: "WSH", atVs: "@", stats: ["6", "9", "95", "15.8", "0", "28", "0", "0", "0.0", "0", "0"] },
    { eventId: "e4", date: "2025-12-14T18:00:00.000+00:00", opp: "LV", atVs: "vs", stats: ["3", "6", "41", "13.7", "0", "19", "0", "0", "0.0", "0", "0"] },
    { eventId: "e3", date: "2025-12-09T01:15:00.000+00:00", opp: "LAC", atVs: "@", stats: ["7", "11", "100", "14.3", "1", "34", "0", "0", "0.0", "0", "0"] },
    { eventId: "e2", date: "2025-11-28T20:00:00.000+00:00", opp: "CHI", atVs: "vs", stats: ["8", "12", "132", "16.5", "2", "45", "1", "8", "8.0", "8", "0"] },
    { eventId: "e1", date: "2025-11-23T21:25:00.000+00:00", opp: "DAL", atVs: "@", stats: ["5", "8", "49", "9.8", "0", "16", "0", "0", "0.0", "0", "0"] },
  ]),
  // Drake Maye (QB) -- real athlete id from the roster endpoint.
  "football/nfl:4431452": makeResponse(QB_NAMES, [
    { eventId: "q5", date: "2026-01-12T21:00:00.000+00:00", opp: "LAC", atVs: "vs", stats: ["24", "35", "268", "68.6", "7.7", "2", "0", "41", "1", "104.2", "62.1", "4", "18", "4.5", "0", "11"] },
    { eventId: "q4", date: "2026-01-04T18:00:00.000+00:00", opp: "MIA", atVs: "vs", stats: ["18", "29", "191", "62.1", "6.6", "1", "1", "33", "2", "82.4", "51.0", "3", "12", "4.0", "0", "7"] },
    { eventId: "q3", date: "2025-12-28T21:25:00.000+00:00", opp: "BUF", atVs: "@", stats: ["27", "38", "295", "71.1", "7.8", "3", "0", "48", "1", "112.6", "71.3", "5", "31", "6.2", "1", "14"] },
    { eventId: "q2", date: "2025-12-20T22:00:00.000+00:00", opp: "WSH", atVs: "@", stats: ["15", "26", "179", "57.7", "6.9", "1", "2", "29", "3", "68.9", "38.4", "2", "9", "4.5", "0", "6"] },
    { eventId: "q1", date: "2025-12-14T18:00:00.000+00:00", opp: "LV", atVs: "vs", stats: ["22", "31", "244", "71.0", "7.9", "2", "0", "37", "0", "108.1", "67.5", "6", "24", "4.0", "0", "9"] },
  ]),
};

// Deterministic, offline implementation for development/testing -- mirrors
// lib/rosters/mockProvider.ts's role for the roster layer. An athlete with no fixture returns
// an empty-but-valid response, the same graceful "no history available" shape a real player
// with no logged games would produce.
export function createMockPlayerStatsProvider(): PlayerStatsProvider {
  return {
    async getGameLog(sportPath: string, athleteId: string): Promise<EspnGameLogResponse> {
      return GAME_LOGS[`${sportPath}:${athleteId}`] ?? { names: [], labels: [], events: {}, seasonTypes: [] };
    },
  };
}
