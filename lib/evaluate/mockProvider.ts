import type { BoxScore, BoxScoreProvider } from "./types";

// Small inline fixtures, mirrors lib/rosters/mockProvider.ts's role. Keyed by
// "sportPath:eventId", one fixture per game-state so a manual walkthrough can exercise
// pending -> partially-clinched -> fully-resolved without touching the network.
const BOX_SCORES: Record<string, BoxScore> = {
  "football/nfl:mock-pre": {
    status: { state: "pre", completed: false, detail: "Scheduled" },
    homeScore: null,
    awayScore: null,
    playerStats: new Map(),
  },
  "football/nfl:mock-live": {
    status: { state: "in", completed: false, detail: "Q3 8:14" },
    homeScore: 17,
    awayScore: 20,
    playerStats: new Map([
      [
        "patrick mahomes",
        new Map([
          ["passing.passingYards", "310"],
          ["passing.passingTouchdowns", "2"],
          ["passing.completions/passingAttempts", "22/29"],
        ]),
      ],
      ["travis kelce", new Map([["receiving.receivingYards", "85"]])],
    ]),
  },
  "football/nfl:mock-final": {
    status: { state: "post", completed: true, detail: "Final" },
    homeScore: 24,
    awayScore: 20,
    playerStats: new Map([
      [
        "patrick mahomes",
        new Map([
          ["passing.passingYards", "340"],
          ["passing.passingTouchdowns", "3"],
          ["passing.completions/passingAttempts", "26/34"],
        ]),
      ],
      ["travis kelce", new Map([["receiving.receivingYards", "95"]])],
    ]),
  },
};

export function createMockBoxScoreProvider(): BoxScoreProvider {
  return {
    async getBoxScore(sportPath: string, eventId: string): Promise<BoxScore> {
      return (
        BOX_SCORES[`${sportPath}:${eventId}`] ?? {
          status: { state: "pre", completed: false, detail: "Scheduled" },
          homeScore: null,
          awayScore: null,
          playerStats: new Map(),
        }
      );
    },
  };
}
