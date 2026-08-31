import { describe, expect, it } from "vitest";

import { Market, Side } from "@/app/generated/prisma/enums";

import {
  altLinesForMarket,
  buildResearchGame,
  categorizeBaseMarket,
  groupRowsByGame,
  mapGameLinesSelectionToPick,
  stripSegmentPrefix,
  summarizeSchedule,
} from "./categorize";
import type { SharpApiRow } from "./types";

// Base rows below are verbatim (or trivially trimmed) real examples captured from SharpAPI
// during Phase 2.14 implementation -- see the plan file's "Verified this session" section.
function row(overrides: Partial<SharpApiRow>): SharpApiRow {
  return {
    id: "row-1",
    sportsbook: "draftkings",
    event_id: "nfl_patriots_seahawks_2026-09-09_b3",
    home_team: "Seattle Seahawks",
    away_team: "New England Patriots",
    market_type: "moneyline",
    selection: "NE Patriots",
    selection_type: "away",
    odds_american: 150,
    line: null,
    event_start_time: "2026-09-10T00:15Z",
    is_player_prop: false,
    ...overrides,
  };
}

describe("stripSegmentPrefix", () => {
  it("strips the confirmed 1st_half prefix", () => {
    expect(stripSegmentPrefix("1st_half_point_spread")).toEqual({ base: "point_spread", segment: "1st_half" });
  });

  it("strips the confirmed 1st_quarter prefix", () => {
    expect(stripSegmentPrefix("1st_quarter_moneyline")).toEqual({ base: "moneyline", segment: "1st_quarter" });
  });

  it("strips the other three confirmed quarter/half prefixes", () => {
    expect(stripSegmentPrefix("2nd_half_total_points")).toEqual({ base: "total_points", segment: "2nd_half" });
    expect(stripSegmentPrefix("2nd_quarter_point_spread")).toEqual({ base: "point_spread", segment: "2nd_quarter" });
    expect(stripSegmentPrefix("3rd_quarter_point_spread")).toEqual({ base: "point_spread", segment: "3rd_quarter" });
    expect(stripSegmentPrefix("4th_quarter_total_points")).toEqual({ base: "total_points", segment: "4th_quarter" });
  });

  it("leaves an unprefixed full-game market_type untouched", () => {
    expect(stripSegmentPrefix("total_points")).toEqual({ base: "total_points", segment: null });
  });
});

describe("categorizeBaseMarket", () => {
  it("buckets the three confirmed full-game markets as game_lines", () => {
    for (const base of ["moneyline", "point_spread", "total_points"]) {
      expect(categorizeBaseMarket(base, row({ market_type: base }))).toBe("game_lines");
    }
  });

  it("buckets confirmed player-prop markets by stat group", () => {
    expect(categorizeBaseMarket("player_passing_yards", row({ is_player_prop: true }))).toBe("passing");
    expect(categorizeBaseMarket("player_passing_touchdowns", row({ is_player_prop: true }))).toBe("passing");
    expect(categorizeBaseMarket("player_receiving_yards", row({ is_player_prop: true }))).toBe("receiving");
    expect(categorizeBaseMarket("player_receptions", row({ is_player_prop: true }))).toBe("receiving");
    expect(categorizeBaseMarket("player_rushing_yards", row({ is_player_prop: true }))).toBe("rushing");
  });

  it("routes an unrecognized market_type to uncategorized instead of guessing", () => {
    // team_total is deliberately excluded even though it's confirmed real and high-volume --
    // its compound selection_type has no matching Market/Side combination in the schema.
    expect(categorizeBaseMarket("team_total", row({ market_type: "team_total" }))).toBe("uncategorized");
    expect(categorizeBaseMarket("winning_margin", row({ market_type: "winning_margin" }))).toBe("uncategorized");
    expect(categorizeBaseMarket("mvp", row({ market_type: "mvp", is_player_prop: false }))).toBe("uncategorized");
    expect(
      categorizeBaseMarket("player_anytime_touchdown", row({ market_type: "player_anytime_touchdown", is_player_prop: true })),
    ).toBe("uncategorized");
  });

  it("buckets the three confirmed TD-scorer markets as td_scorers regardless of is_player_prop", () => {
    expect(categorizeBaseMarket("player_touchdowns", row({ market_type: "player_touchdowns", is_player_prop: true }))).toBe(
      "td_scorers",
    );
    // first/last_touchdown_scorer really do ship is_player_prop: false despite having a
    // real player_name -- confirmed real, not a guess.
    expect(
      categorizeBaseMarket("first_touchdown_scorer", row({ market_type: "first_touchdown_scorer", is_player_prop: false })),
    ).toBe("td_scorers");
    expect(
      categorizeBaseMarket("last_touchdown_scorer", row({ market_type: "last_touchdown_scorer", is_player_prop: false })),
    ).toBe("td_scorers");
  });
});

describe("groupRowsByGame", () => {
  it("drops futures/specials rows with no real away team", () => {
    const games = groupRowsByGame([
      row({}),
      row({
        id: "futures-1",
        event_id: "nfl__nflspecials_2026-08-31_b1",
        home_team: "NFL Specials",
        away_team: "",
        market_type: "mvp",
        selection_type: "outright",
      }),
    ]);
    expect(games).toHaveLength(1);
    expect(games[0].externalId).toBe("nfl_patriots_seahawks_2026-09-09_b3");
  });

  it("groups full-game and segment rows into separate market groups under game_lines", () => {
    const games = groupRowsByGame([
      row({ id: "ml-away", market_type: "moneyline", selection_type: "away" }),
      row({ id: "ml-home", market_type: "moneyline", selection_type: "home" }),
      row({ id: "1h-ml-home", market_type: "1st_half_moneyline", selection_type: "home" }),
    ]);
    expect(games).toHaveLength(1);
    const gameLines = games[0].categories.find((c) => c.key === "game_lines");
    expect(gameLines).toBeDefined();
    expect(gameLines!.marketGroups).toHaveLength(2);
    const fullGame = gameLines!.marketGroups.find((g) => g.segment === null)!;
    const segment = gameLines!.marketGroups.find((g) => g.segment === "1st_half")!;
    expect(fullGame.selections).toHaveLength(2);
    expect(segment.selections).toHaveLength(1);
  });

  it("groups a player's multiple tiered lines under the same market group", () => {
    const games = groupRowsByGame([
      row({
        id: "rec-85",
        market_type: "player_receiving_yards",
        is_player_prop: true,
        player_name: "Jaxon Smith-Njigba",
        selection: "Over",
        selection_type: "over",
        line: 85,
      }),
      row({
        id: "rec-100",
        market_type: "player_receiving_yards",
        is_player_prop: true,
        player_name: "Jaxon Smith-Njigba",
        selection: "Over",
        selection_type: "over",
        line: 100,
      }),
    ]);
    const receiving = games[0].categories.find((c) => c.key === "receiving")!;
    expect(receiving.marketGroups).toHaveLength(1);
    expect(receiving.marketGroups[0].selections.map((s) => s.line)).toEqual([85, 100]);
  });

  it("drops a row whose selection_type isn't a recognized pickable side", () => {
    const games = groupRowsByGame([
      row({ id: "margin", market_type: "winning_margin", selection_type: "other", selection: "To Win By 37-42" }),
    ]);
    // The row exists but produces no selection (selection_type "other" is unrecognized) --
    // no game should be created from an event with zero pickable selections.
    expect(games).toHaveLength(0);
  });

  it("maps first/last_touchdown_scorer's 'other' selection_type to Side.YES, but not winning_margin's", () => {
    const games = groupRowsByGame([
      row({
        id: "first-td",
        market_type: "first_touchdown_scorer",
        selection_type: "other",
        selection: "Rhamondre Stevenson",
        player_name: "Rhamondre Stevenson",
        line: null,
      }),
      row({ id: "margin", market_type: "winning_margin", selection_type: "other", selection: "To Win By 37-42" }),
    ]);
    const tdScorers = games[0].categories.find((c) => c.key === "td_scorers")!;
    expect(tdScorers.marketGroups).toHaveLength(1);
    expect(tdScorers.marketGroups[0].selections[0].side).toBe(Side.YES);
    // winning_margin still isn't wired -- confirms the "other" mapping is whitelisted per
    // market_type, not a blanket rule.
    expect(games[0].categories.find((c) => c.key === "uncategorized")).toBeUndefined();
  });

  it("tracks isMainLine per selection, defaulting to true when the field is absent", () => {
    const games = groupRowsByGame([
      row({ id: "main", market_type: "point_spread", is_main_line: true, line: 3.5 }),
      row({ id: "alt", market_type: "point_spread", is_main_line: false, line: 7 }),
      row({ id: "no-flag", market_type: "moneyline" }), // is_main_line omitted entirely
    ]);
    const gameLines = games[0].categories.find((c) => c.key === "game_lines")!;
    const spread = gameLines.marketGroups.find((g) => g.marketType === "point_spread")!;
    expect(spread.selections.find((s) => s.selectionId === "main")?.isMainLine).toBe(true);
    expect(spread.selections.find((s) => s.selectionId === "alt")?.isMainLine).toBe(false);
    const moneyline = gameLines.marketGroups.find((g) => g.marketType === "moneyline")!;
    expect(moneyline.selections[0].isMainLine).toBe(true);
  });
});

describe("altLinesForMarket", () => {
  it("returns only non-main-line selections, grouped by side and sorted by line", () => {
    const game = buildResearchGame([
      row({ id: "main", market_type: "point_spread", selection_type: "away", is_main_line: true, line: 3.5 }),
      row({ id: "alt-2", market_type: "point_spread", selection_type: "away", is_main_line: false, line: 10 }),
      row({ id: "alt-1", market_type: "point_spread", selection_type: "away", is_main_line: false, line: 7 }),
    ])!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    const alts = altLinesForMarket(gameLines, "point_spread", null);
    expect(alts).toHaveLength(1);
    expect(alts[0].side).toBe(Side.AWAY);
    expect(alts[0].selections.map((s) => s.line)).toEqual([7, 10]);
  });

  it("returns an empty array when every selection is the main line", () => {
    const game = buildResearchGame([row({ id: "main", market_type: "point_spread", is_main_line: true })])!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    expect(altLinesForMarket(gameLines, "point_spread", null)).toEqual([]);
  });
});

describe("mapGameLinesSelectionToPick", () => {
  const game = { homeTeam: "Seattle Seahawks", awayTeam: "New England Patriots", externalId: "evt-1" };

  it("maps moneyline/point_spread/total_points to the right Market", () => {
    const selection = {
      selectionId: "s1",
      selection: "NE Patriots",
      line: null,
      priceAmerican: 150,
      side: Side.AWAY,
      playerName: null,
      isMainLine: true,
      sportsbook: "draftkings",
    };
    expect(mapGameLinesSelectionToPick(game, "moneyline", selection)?.market).toBe(Market.MONEYLINE);
    expect(mapGameLinesSelectionToPick(game, "point_spread", { ...selection, line: 3.5 })?.market).toBe(Market.SPREAD);
    expect(mapGameLinesSelectionToPick(game, "total_points", { ...selection, side: Side.OVER, line: 44.5 })?.market).toBe(
      Market.TOTAL,
    );
  });

  it("returns null for a market_type it doesn't recognize", () => {
    const selection = {
      selectionId: "s1",
      selection: "x",
      line: null,
      priceAmerican: 100,
      side: Side.HOME,
      playerName: null,
      isMainLine: true,
      sportsbook: "draftkings",
    };
    expect(mapGameLinesSelectionToPick(game, "team_total", selection)).toBeNull();
  });
});

describe("summarizeSchedule", () => {
  it("dedupes moneyline rows into one summary per event", () => {
    const summaries = summarizeSchedule([
      row({ id: "a", event_id: "evt-1", selection_type: "away" }),
      row({ id: "b", event_id: "evt-1", selection_type: "home", home_team: "Seattle Seahawks" }),
      row({
        id: "c",
        event_id: "evt-2",
        home_team: "Los Angeles Rams",
        away_team: "San Francisco 49ers",
        event_start_time: "2026-09-15T00:05Z",
      }),
    ]);
    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.externalId).sort()).toEqual(["evt-1", "evt-2"]);
  });

  it("drops rows with no real away team (a real fetch should never send these on a moneyline-filtered call, but stay defensive)", () => {
    const summaries = summarizeSchedule([row({ home_team: "NFL Specials", away_team: "" })]);
    expect(summaries).toHaveLength(0);
  });

  it("sorts by commence time", () => {
    const summaries = summarizeSchedule([
      row({ id: "a", event_id: "evt-later", event_start_time: "2026-09-20T00:00Z" }),
      row({ id: "b", event_id: "evt-earlier", event_start_time: "2026-09-10T00:00Z" }),
    ]);
    expect(summaries.map((s) => s.externalId)).toEqual(["evt-earlier", "evt-later"]);
  });
});

describe("buildResearchGame", () => {
  it("builds a single categorized game from one event's rows", () => {
    const game = buildResearchGame([
      row({ id: "ml-away", market_type: "moneyline", selection_type: "away" }),
      row({ id: "ml-home", market_type: "moneyline", selection_type: "home" }),
    ]);
    expect(game).not.toBeNull();
    expect(game!.externalId).toBe("nfl_patriots_seahawks_2026-09-09_b3");
    expect(game!.categories.find((c) => c.key === "game_lines")).toBeDefined();
  });

  it("returns null when the rows produce no pickable game (e.g. futures only)", () => {
    const game = buildResearchGame([row({ home_team: "NFL Specials", away_team: "" })]);
    expect(game).toBeNull();
  });
});
