import { describe, expect, it } from "vitest";

import { DEFAULT_PROP_MARKETS, TEAM_MARKETS } from "./mapping";
import { createMockProvider } from "./mockProvider";

describe("createMockProvider", () => {
  it("lists the fixture slate of NFL games via the free events call", async () => {
    const provider = createMockProvider();
    const games = await provider.listEvents("americanfootball_nfl");
    expect(games.length).toBeGreaterThan(0);
    expect(games.some((g) => g.homeTeam === "Chiefs" && g.awayTeam === "Broncos")).toBe(true);
  });

  it("returns no events for a sport key with no fixture (e.g. the preseason key)", async () => {
    const provider = createMockProvider();
    const games = await provider.listEvents("americanfootball_nfl_preseason");
    expect(games).toEqual([]);
  });

  it("returns team-market odds for a known event", async () => {
    const provider = createMockProvider();
    const odds = await provider.getEventOdds("americanfootball_nfl", "evt_chiefs_broncos", TEAM_MARKETS);
    const spreads = odds.bookmakers[0]?.markets.find((m) => m.key === "spreads");
    expect(spreads).toBeDefined();
    // Only the requested markets come back, not prop markets even though that event has them.
    expect(odds.bookmakers[0]?.markets.some((m) => m.key.startsWith("player_"))).toBe(false);
  });

  it("returns the matching props fixture for a known event", async () => {
    const provider = createMockProvider();
    const props = await provider.getEventOdds("americanfootball_nfl", "evt_chiefs_broncos", DEFAULT_PROP_MARKETS);
    expect(props.bookmakers.length).toBeGreaterThan(0);
    const passYds = props.bookmakers[0].markets.find((m) => m.key === "player_pass_yds");
    expect(passYds?.outcomes.some((o) => o.description === "Patrick Mahomes")).toBe(true);
    // Only the requested (prop) markets come back, not the game's team markets.
    expect(props.bookmakers[0].markets.some((m) => m.key === "spreads")).toBe(false);
  });

  it("returns an empty-bookmakers result (not an error) for a game with no props posted", async () => {
    const provider = createMockProvider();
    const props = await provider.getEventOdds("americanfootball_nfl", "evt_bills_jets", DEFAULT_PROP_MARKETS);
    expect(props.bookmakers).toEqual([]);
    expect(props.homeTeam).toBe("Bills");
  });

  it("returns an empty-bookmakers result for a completely unknown event id too", async () => {
    const provider = createMockProvider();
    const props = await provider.getEventOdds("americanfootball_nfl", "not-a-real-id", DEFAULT_PROP_MARKETS);
    expect(props.bookmakers).toEqual([]);
  });
});
