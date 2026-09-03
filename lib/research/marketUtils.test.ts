import { describe, expect, it } from "vitest";

import { Side } from "@/app/generated/prisma/enums";

import { mergeResearchGames } from "./marketUtils";
import type { ResearchGame, ResearchSelection } from "./types";

function selection(overrides: Partial<ResearchSelection> & Pick<ResearchSelection, "selectionId" | "side" | "priceAmerican">): ResearchSelection {
  return {
    selection: overrides.side,
    line: null,
    playerName: null,
    sportsbook: "draftkings",
    isMainLine: true,
    teamSide: null,
    ...overrides,
  };
}

function game(externalId: string, categories: ResearchGame["categories"]): ResearchGame {
  return { externalId, homeTeam: "Home", awayTeam: "Away", commenceTime: "2026-09-10T00:20:00Z", categories };
}

describe("mergeResearchGames", () => {
  it("takes matchup identity from the first game", () => {
    const a = game("primary-id", []);
    const b: ResearchGame = { ...game("other-id", []), homeTeam: "Different Home" };
    const merged = mergeResearchGames([a, b]);
    expect(merged.externalId).toBe("primary-id");
    expect(merged.homeTeam).toBe("Home");
  });

  it("merges non-overlapping selections from two providers into the same market group", () => {
    const a = game("id-1", [
      { key: "passing", marketGroups: [{ marketType: "player_passing_yards", segment: null, selections: [selection({ selectionId: "a-1", side: Side.OVER, priceAmerican: -114, playerName: "Drake Maye", sportsbook: "draftkings" })] }] },
    ]);
    const b = game("id-2", [
      { key: "passing", marketGroups: [{ marketType: "player_passing_yards", segment: null, selections: [selection({ selectionId: "b-1", side: Side.OVER, priceAmerican: -110, playerName: "Drake Maye", sportsbook: "fanduel" })] }] },
    ]);
    const merged = mergeResearchGames([a, b]);
    const group = merged.categories.find((c) => c.key === "passing")!.marketGroups[0];
    expect(group.selections).toHaveLength(2);
    expect(group.selections.map((s) => s.sportsbook).sort()).toEqual(["draftkings", "fanduel"]);
  });

  it("deduplicates the exact same real bet (same book/side/player/line/isMainLine) reported by two providers", () => {
    const a = game("id-1", [
      { key: "passing", marketGroups: [{ marketType: "player_passing_yards", segment: null, selections: [selection({ selectionId: "a-1", side: Side.OVER, priceAmerican: -114, playerName: "Drake Maye", sportsbook: "draftkings", line: 226.5 })] }] },
    ]);
    const b = game("id-2", [
      { key: "passing", marketGroups: [{ marketType: "player_passing_yards", segment: null, selections: [selection({ selectionId: "b-1", side: Side.OVER, priceAmerican: -113, playerName: "Drake Maye", sportsbook: "draftkings", line: 226.5 })] }] },
    ]);
    const merged = mergeResearchGames([a, b]);
    const group = merged.categories.find((c) => c.key === "passing")!.marketGroups[0];
    expect(group.selections).toHaveLength(1);
    // First provider (a) wins -- ParlayAPI's own real ordering convention (basis first).
    expect(group.selections[0].priceAmerican).toBe(-114);
  });

  it("does not collapse a real tiered ladder into one entry -- distinct lines stay distinct even with everything else identical", () => {
    const a = game("id-1", [
      {
        key: "receiving",
        marketGroups: [
          {
            marketType: "player_receiving_yards",
            segment: null,
            selections: [
              selection({ selectionId: "a-1", side: Side.OVER, priceAmerican: 100, playerName: "A.J. Brown", sportsbook: "caesars", isMainLine: false, line: 60 }),
              selection({ selectionId: "a-2", side: Side.OVER, priceAmerican: 200, playerName: "A.J. Brown", sportsbook: "caesars", isMainLine: false, line: 80 }),
            ],
          },
        ],
      },
    ]);
    const merged = mergeResearchGames([a]);
    const group = merged.categories.find((c) => c.key === "receiving")!.marketGroups[0];
    expect(group.selections).toHaveLength(2);
    expect(group.selections.map((s) => s.line).sort()).toEqual([60, 80]);
  });

  it("fills in a category the primary provider doesn't have at all (e.g. Kicking from a secondary provider)", () => {
    const a = game("id-1", [{ key: "passing", marketGroups: [{ marketType: "player_passing_yards", segment: null, selections: [selection({ selectionId: "a-1", side: Side.OVER, priceAmerican: -114 })] }] }]);
    const b = game("id-2", [{ key: "kicking", marketGroups: [{ marketType: "player_kicking_points", segment: null, selections: [selection({ selectionId: "b-1", side: Side.OVER, priceAmerican: 100 })] }] }]);
    const merged = mergeResearchGames([a, b]);
    expect(merged.categories.find((c) => c.key === "passing")).toBeDefined();
    expect(merged.categories.find((c) => c.key === "kicking")).toBeDefined();
  });
});
