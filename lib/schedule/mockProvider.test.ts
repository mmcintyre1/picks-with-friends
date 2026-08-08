import { describe, expect, it } from "vitest";

import { createMockScheduleProvider } from "./mockProvider";

describe("createMockScheduleProvider", () => {
  it("returns fixture games for a known league", async () => {
    const provider = createMockScheduleProvider();
    const games = await provider.listUpcomingGames("NBA");
    expect(games.some((g) => g.homeTeam === "Boston Celtics")).toBe(true);
  });

  it("returns fixture games for NFL", async () => {
    const provider = createMockScheduleProvider();
    const games = await provider.listUpcomingGames("NFL");
    expect(games.some((g) => g.homeTeam === "Denver Broncos")).toBe(true);
  });

  it("returns an empty list for an off-season league, not an error", async () => {
    const provider = createMockScheduleProvider();
    const games = await provider.listUpcomingGames("NHL");
    expect(games).toEqual([]);
  });

  it("returns an empty list for an unmapped league", async () => {
    const provider = createMockScheduleProvider();
    const games = await provider.listUpcomingGames("SOCCER");
    expect(games).toEqual([]);
  });
});
