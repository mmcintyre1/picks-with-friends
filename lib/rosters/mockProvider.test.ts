import { describe, expect, it } from "vitest";

import { createMockRosterProvider } from "./mockProvider";

describe("createMockRosterProvider", () => {
  it("returns the fixture roster for a known NFL team id", async () => {
    const provider = createMockRosterProvider();
    const players = await provider.getRoster("football/nfl", "12");
    expect(players.some((p) => p.name === "Patrick Mahomes")).toBe(true);
  });

  it("returns fixture rosters for NBA/MLB/NHL too", async () => {
    const provider = createMockRosterProvider();
    expect((await provider.getRoster("basketball/nba", "2")).some((p) => p.name === "Jayson Tatum")).toBe(true);
    expect((await provider.getRoster("baseball/mlb", "15")).some((p) => p.name === "Spencer Strider")).toBe(true);
    expect((await provider.getRoster("hockey/nhl", "1")).some((p) => p.name === "David Pastrnak")).toBe(true);
  });

  it("returns an empty list for an unknown team id, not an error", async () => {
    const provider = createMockRosterProvider();
    const players = await provider.getRoster("football/nfl", "not-a-real-id");
    expect(players).toEqual([]);
  });
});
