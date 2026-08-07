import { describe, expect, it } from "vitest";

import { createMockProvider } from "./mockProvider";

describe("createMockProvider", () => {
  it("lists the fixture slate of NFL games", async () => {
    const provider = createMockProvider();
    const games = await provider.listGamesWithOdds("americanfootball_nfl");
    expect(games.length).toBeGreaterThan(0);
    expect(games.some((g) => g.homeTeam === "Chiefs" && g.awayTeam === "Broncos")).toBe(true);
  });

  it("returns the matching props fixture for a known event", async () => {
    const provider = createMockProvider();
    const props = await provider.listPlayerProps("americanfootball_nfl", "evt_chiefs_broncos");
    expect(props.bookmakers.length).toBeGreaterThan(0);
    const passYds = props.bookmakers[0].markets.find((m) => m.key === "player_pass_yds");
    expect(passYds?.outcomes.some((o) => o.description === "Patrick Mahomes")).toBe(true);
  });

  it("returns an empty-bookmakers result (not an error) for a game with no props posted", async () => {
    const provider = createMockProvider();
    const props = await provider.listPlayerProps("americanfootball_nfl", "evt_bills_jets");
    expect(props.bookmakers).toEqual([]);
    expect(props.homeTeam).toBe("Bills");
  });

  it("returns an empty-bookmakers result for a completely unknown event id too", async () => {
    const provider = createMockProvider();
    const props = await provider.listPlayerProps("americanfootball_nfl", "not-a-real-id");
    expect(props.bookmakers).toEqual([]);
  });
});
