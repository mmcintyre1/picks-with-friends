import { describe, expect, it } from "vitest";

import { Side } from "@/app/generated/prisma/enums";

import { buildResearchGame, summarizeSchedule } from "./categorize";
import type { ParlayApiEvent, ParlayApiEventData, ParlayApiGameOdds, ParlayApiProp } from "./types";

const HOME = "Seattle Seahawks";
const AWAY = "New England Patriots";

function odds(overrides: Partial<ParlayApiGameOdds> = {}): ParlayApiGameOdds {
  return {
    id: "evt-1",
    sport_key: "americanfootball_nfl",
    sport_title: "NFL",
    commence_time: "2026-09-10T00:20:00Z",
    home_team: HOME,
    away_team: AWAY,
    bookmakers: [],
    ...overrides,
  };
}

function prop(overrides: Partial<ParlayApiProp> & Pick<ParlayApiProp, "market_key" | "player" | "line" | "over_price" | "under_price">): ParlayApiProp {
  return {
    event_id: "evt-1",
    canonical_event_id: "canon-1",
    sport_key: "americanfootball_nfl",
    game_date: "2026-09-10",
    home_team: HOME,
    away_team: AWAY,
    commence_time: "2026-09-10T00:20:00Z",
    bookmaker: "draftkings",
    bookmaker_title: "DraftKings",
    market: overrides.market_key,
    implied_probability: 50,
    is_dfs_flat_payout: false,
    dfs_normalized: false,
    last_update: "",
    age_seconds: 0,
    ...overrides,
  };
}

function data(o: ParlayApiGameOdds | null, props: ParlayApiProp[]): ParlayApiEventData {
  return { homeTeam: HOME, awayTeam: AWAY, commenceTime: "2026-09-10T00:20:00Z", odds: o, props };
}

describe("buildResearchGame -- game lines from /odds", () => {
  it("maps h2h/spreads/totals via outcome.name matching home/away/Over/Under", () => {
    const game = buildResearchGame(
      "evt-1",
      data(
        odds({
          bookmakers: [
            {
              key: "draftkings",
              title: "DraftKings",
              last_update: "",
              markets: [
                { key: "h2h", last_update: "", outcomes: [{ name: HOME, price: -198 }, { name: AWAY, price: 166 }] },
                { key: "spreads", last_update: "", outcomes: [{ name: HOME, price: -112, point: -3.5 }, { name: AWAY, price: -108, point: 3.5 }] },
                { key: "totals", last_update: "", outcomes: [{ name: "Over", price: -110, point: 44.5 }, { name: "Under", price: -110, point: 44.5 }] },
              ],
            },
          ],
        }),
        [],
      ),
    )!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    const ml = gameLines.marketGroups.find((g) => g.marketType === "moneyline")!;
    expect(ml.selections.find((s) => s.side === Side.HOME)?.priceAmerican).toBe(-198);
    const sp = gameLines.marketGroups.find((g) => g.marketType === "point_spread")!;
    expect(sp.selections.find((s) => s.side === Side.AWAY)?.line).toBe(3.5);
    const tot = gameLines.marketGroups.find((g) => g.marketType === "total_points")!;
    expect(tot.selections.find((s) => s.side === Side.OVER)?.line).toBe(44.5);
  });

  it("drops an outcome whose name matches neither team nor Over/Under", () => {
    const game = buildResearchGame(
      "evt-1",
      data(
        odds({
          bookmakers: [
            {
              key: "draftkings",
              title: "DraftKings",
              last_update: "",
              markets: [{ key: "h2h", last_update: "", outcomes: [{ name: "Draw", price: 500 }] }],
            },
          ],
        }),
        [],
      ),
    );
    expect(game).toBeNull();
  });
});

describe("buildResearchGame -- milestone ladder folding", () => {
  it("folds milestone-suffixed rows into the same marketType as the bare main-line row, main line only for the bare row", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [
        prop({ market_key: "player_receiving_yards", player: "A.J. Brown", line: 60.5, over_price: -114, under_price: -114 }),
        prop({ market_key: "player_receiving_yards_milestones_100_or_more", player: "A.J. Brown", line: 100, over_price: 370, under_price: null }),
        prop({ market_key: "player_receiving_yards_milestones_150_or_more", player: "A.J. Brown", line: 150, over_price: 900, under_price: null }),
      ]),
    )!;
    const receiving = game.categories.find((c) => c.key === "receiving")!;
    const group = receiving.marketGroups.find((g) => g.marketType === "player_receiving_yards")!;
    expect(group.selections).toHaveLength(4); // main over + main under + 2 milestone overs
    const main = group.selections.filter((s) => s.isMainLine);
    expect(main).toHaveLength(2);
    expect(main.map((s) => s.side).sort()).toEqual([Side.OVER, Side.UNDER].sort());
    const alts = group.selections.filter((s) => !s.isMainLine);
    expect(alts).toHaveLength(2);
    expect(alts.every((s) => s.side === Side.OVER)).toBe(true);
    expect(alts.map((s) => s.line).sort()).toEqual([100, 150]);
  });

  it("uses the row's own numeric line field for a milestone tier, not a number parsed from the market_key", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [prop({ market_key: "player_passing_yards_milestones_275_or_more", player: "Drake Maye", line: 275, over_price: 260, under_price: null })]),
    )!;
    const passing = game.categories.find((c) => c.key === "passing")!;
    const group = passing.marketGroups.find((g) => g.marketType === "player_passing_yards")!;
    expect(group.selections[0].line).toBe(275);
    expect(group.selections[0].isMainLine).toBe(false);
  });
});

describe("buildResearchGame -- TD scorer markets", () => {
  it("maps anytime/first/last touchdown scorer to Side.YES from over_price, ignoring null under_price", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [
        prop({ market_key: "player_anytime_touchdown_scorer", player: "A.J. Brown", line: 0, over_price: 165, under_price: null }),
        prop({ market_key: "player_first_touchdown_scorer", player: "A.J. Brown", line: 0, over_price: 900, under_price: null }),
        prop({ market_key: "player_last_touchdown_scorer", player: "George Holani", line: 0, over_price: 1100, under_price: null }),
      ]),
    )!;
    const tdScorers = game.categories.find((c) => c.key === "td_scorers")!;
    const anytime = tdScorers.marketGroups.find((g) => g.marketType === "player_anytime_touchdown")!;
    expect(anytime.selections[0].side).toBe(Side.YES);
    expect(anytime.selections[0].priceAmerican).toBe(165);
    expect(tdScorers.marketGroups.find((g) => g.marketType === "first_touchdown_scorer")).toBeDefined();
    expect(tdScorers.marketGroups.find((g) => g.marketType === "last_touchdown_scorer")).toBeDefined();
  });

  it("maps player_passing_tds to player_passing_touchdowns under passing (true O/U shape)", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [prop({ market_key: "player_passing_tds", player: "Drake Maye", line: 1.5, over_price: 148, under_price: -197 })]),
    )!;
    const passing = game.categories.find((c) => c.key === "passing")!;
    const group = passing.marketGroups.find((g) => g.marketType === "player_passing_touchdowns")!;
    expect(group.selections).toHaveLength(2);
  });
});

describe("buildResearchGame -- deliberately dropped market shapes", () => {
  it("drops player_total_touchdowns (fake 'player' field is actually a matchup string)", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [prop({ market_key: "player_total_touchdowns", player: "BUF Bills @ HOU Texans", line: 4.5, over_price: -145, under_price: 114 })]),
    );
    expect(game).toBeNull();
  });

  it("drops player_to_score_2_or_more_touchdowns (real threshold lives only in the market_key string)", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [prop({ market_key: "player_to_score_2_or_more_touchdowns", player: "A.J. Brown", line: 0, over_price: 1300, under_price: null })]),
    );
    expect(game).toBeNull();
  });

  it("drops player_1st_half_moneyline (fake 'player' field, no real side discriminator)", () => {
    const game = buildResearchGame(
      "evt-1",
      data(null, [prop({ market_key: "player_1st_half_moneyline", player: "1st half moneyline", line: null, over_price: -160, under_price: null })]),
    );
    expect(game).toBeNull();
  });

  it("returns null when data itself is null (no odds and no props ever fetched successfully)", () => {
    expect(buildResearchGame("evt-1", null)).toBeNull();
  });
});

describe("summarizeSchedule", () => {
  it("tags every game with source: parlayapi", () => {
    const events: ParlayApiEvent[] = [
      { id: "evt-1", canonical_event_id: "canon-1", sport_key: "americanfootball_nfl", sport_title: "NFL", commence_time: "2026-09-10T00:20:00Z", home_team: HOME, away_team: AWAY },
    ];
    const summaries = summarizeSchedule(events);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].source).toBe("parlayapi");
    expect(summaries[0].externalId).toBe("evt-1");
  });
});
