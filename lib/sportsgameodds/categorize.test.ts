import { describe, expect, it } from "vitest";

import { Side } from "@/app/generated/prisma/enums";

import { buildResearchGame, summarizeSchedule } from "./categorize";
import type { SportsGameOddsEvent, SportsGameOddsOdd } from "./types";

function odd(overrides: Partial<SportsGameOddsOdd> & Pick<SportsGameOddsOdd, "oddID" | "statID" | "betTypeID" | "sideID" | "byBookmaker">): SportsGameOddsOdd {
  return {
    marketName: overrides.oddID,
    statEntityID: overrides.playerID ?? overrides.sideID,
    periodID: "game",
    ...overrides,
  };
}

function event(odds: SportsGameOddsOdd[], players: SportsGameOddsEvent["players"] = {}): SportsGameOddsEvent {
  return {
    eventID: "evt-1",
    sportID: "FOOTBALL",
    leagueID: "NFL",
    teams: {
      home: { teamID: "SEA", names: { long: "Seattle Seahawks", medium: "Seahawks", short: "SEA" } },
      away: { teamID: "NE", names: { long: "New England Patriots", medium: "Patriots", short: "NE" } },
    },
    status: { startsAt: "2026-09-10T00:20:00Z" },
    players,
    odds: Object.fromEntries(odds.map((o) => [o.oddID, o])),
  };
}

describe("buildResearchGame -- game lines", () => {
  it("maps points/ml/away and points/sp/home to moneyline and point_spread under game_lines", () => {
    const game = buildResearchGame(
      event([
        odd({ oddID: "ml-away", statID: "points", betTypeID: "ml", sideID: "away", byBookmaker: { draftkings: { odds: "+150", available: true, lastUpdatedAt: "" } } }),
        odd({ oddID: "sp-home", statID: "points", betTypeID: "sp", sideID: "home", byBookmaker: { draftkings: { odds: "-110", overUnder: "3.5", available: true, lastUpdatedAt: "" } } }),
      ]),
    )!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    expect(gameLines).toBeDefined();
    const ml = gameLines.marketGroups.find((g) => g.marketType === "moneyline")!;
    expect(ml.selections[0].side).toBe(Side.AWAY);
    expect(ml.selections[0].priceAmerican).toBe(150);
    const sp = gameLines.marketGroups.find((g) => g.marketType === "point_spread")!;
    expect(sp.selections[0].side).toBe(Side.HOME);
    expect(sp.selections[0].line).toBe(3.5);
  });

  it("maps points/ou to total_points", () => {
    const game = buildResearchGame(
      event([
        odd({ oddID: "ou-over", statID: "points", betTypeID: "ou", sideID: "over", byBookmaker: { draftkings: { odds: "-110", overUnder: "44.5", available: true, lastUpdatedAt: "" } } }),
      ]),
    )!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    expect(gameLines.marketGroups[0].marketType).toBe("total_points");
    expect(gameLines.marketGroups[0].selections[0].side).toBe(Side.OVER);
  });
});

describe("buildResearchGame -- alt lines via byBookmaker.altLines", () => {
  it("splits the top-level entry (main) from altLines[] entries (non-main), filtering unavailable alt lines", () => {
    const game = buildResearchGame(
      event(
        [
          odd({
            oddID: "py-over",
            statID: "passing_yards",
            betTypeID: "ou",
            sideID: "over",
            playerID: "P1",
            byBookmaker: {
              draftkings: {
                odds: "-113",
                overUnder: "224.5",
                available: true,
                lastUpdatedAt: "",
                altLines: [
                  { odds: "+125", overUnder: "239.5", available: true, lastUpdatedAt: "" },
                  { odds: "-113", overUnder: "228.5", available: false, lastUpdatedAt: "" }, // stale, must be filtered
                ],
              },
            },
          }),
        ],
        { P1: { playerID: "P1", name: "Drake Maye" } },
      ),
    )!;
    const passing = game.categories.find((c) => c.key === "passing")!;
    const group = passing.marketGroups.find((g) => g.marketType === "player_passing_yards")!;
    expect(group.selections).toHaveLength(2); // main + 1 available alt (unavailable one dropped)
    const main = group.selections.find((s) => s.isMainLine)!;
    expect(main.line).toBe(224.5);
    const alt = group.selections.find((s) => !s.isMainLine)!;
    expect(alt.line).toBe(239.5);
    expect(alt.priceAmerican).toBe(125);
  });
});

describe("buildResearchGame -- touchdown market shapes stay distinct", () => {
  it("keeps touchdowns/ou (Total TDs) and touchdowns/yn (Anytime TD) as separate market groups", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "td-ou", statID: "touchdowns", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "+3500", overUnder: "1.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "td-yn", statID: "touchdowns", betTypeID: "yn", sideID: "yes", playerID: "P1", byBookmaker: { draftkings: { odds: "+370", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Drake Maye" } },
      ),
    )!;
    const tdScorers = game.categories.find((c) => c.key === "td_scorers")!;
    const totalTds = tdScorers.marketGroups.find((g) => g.marketType === "player_touchdowns")!;
    const anytimeTd = tdScorers.marketGroups.find((g) => g.marketType === "player_anytime_touchdown")!;
    expect(totalTds.selections).toHaveLength(1);
    expect(totalTds.selections[0].side).toBe(Side.OVER);
    expect(totalTds.selections[0].line).toBe(1.5);
    expect(anytimeTd.selections).toHaveLength(1);
    expect(anytimeTd.selections[0].side).toBe(Side.YES);
    expect(anytimeTd.selections[0].line).toBeNull();
  });

  it("keeps passing_touchdowns/ou and passing_touchdowns/yn as separate market groups under passing", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "pt-ou", statID: "passing_touchdowns", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "+139", overUnder: "1.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "pt-yn", statID: "passing_touchdowns", betTypeID: "yn", sideID: "yes", playerID: "P1", byBookmaker: { draftkings: { odds: "-413", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Drake Maye" } },
      ),
    )!;
    const passing = game.categories.find((c) => c.key === "passing")!;
    expect(passing.marketGroups.find((g) => g.marketType === "player_passing_touchdowns")).toBeDefined();
    expect(passing.marketGroups.find((g) => g.marketType === "player_passing_touchdowns_anytime")).toBeDefined();
  });

  it("maps firstTouchdown to first_touchdown_scorer under td_scorers with a null line", () => {
    const game = buildResearchGame(
      event(
        [odd({ oddID: "ft", statID: "firstTouchdown", betTypeID: "yn", sideID: "yes", playerID: "P1", byBookmaker: { draftkings: { odds: "+1900", available: true, lastUpdatedAt: "" } } })],
        { P1: { playerID: "P1", name: "Drake Maye" } },
      ),
    )!;
    const tdScorers = game.categories.find((c) => c.key === "td_scorers")!;
    const group = tdScorers.marketGroups.find((g) => g.marketType === "first_touchdown_scorer")!;
    expect(group.selections[0].side).toBe(Side.YES);
    expect(group.selections[0].line).toBeNull();
  });
});

describe("buildResearchGame -- rushing+receiving_yards maps to player_rush_rec_yards under rushing", () => {
  it("categorizes the combined market under rushing, distinct from plain rushing_yards", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "rush", statID: "rushing_yards", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "-110", overUnder: "24.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "rushrec", statID: "rushing+receiving_yards", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "-111", overUnder: "60.5", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Rhamondre Stevenson" } },
      ),
    )!;
    const rushing = game.categories.find((c) => c.key === "rushing")!;
    expect(rushing.marketGroups.find((g) => g.marketType === "player_rushing_yards")).toBeDefined();
    const combo = rushing.marketGroups.find((g) => g.marketType === "player_rush_rec_yards")!;
    expect(combo.selections[0].line).toBe(60.5);
  });
});

describe("buildResearchGame -- segments", () => {
  it("maps periodID game/1q/2q/3q/4q to the same segment strings SharpAPI uses", () => {
    const game = buildResearchGame(
      event([
        odd({ oddID: "g", statID: "points", betTypeID: "ml", sideID: "away", periodID: "game", byBookmaker: { draftkings: { odds: "+150", available: true, lastUpdatedAt: "" } } }),
        odd({ oddID: "q1", statID: "points", betTypeID: "ml", sideID: "away", periodID: "1q", byBookmaker: { draftkings: { odds: "+300", available: true, lastUpdatedAt: "" } } }),
      ]),
    )!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    expect(gameLines.marketGroups.find((g) => g.marketType === "moneyline" && g.segment === null)).toBeDefined();
    expect(gameLines.marketGroups.find((g) => g.marketType === "moneyline" && g.segment === "1st_quarter")).toBeDefined();
  });

  it("keeps an unconfirmed periodID as its own segment bucket rather than merging it into the full-game view", () => {
    const game = buildResearchGame(
      event([
        odd({ oddID: "g", statID: "points", betTypeID: "ml", sideID: "away", periodID: "game", byBookmaker: { draftkings: { odds: "+150", available: true, lastUpdatedAt: "" } } }),
        odd({ oddID: "weird", statID: "points", betTypeID: "ml", sideID: "away", periodID: "some_unconfirmed_period", byBookmaker: { draftkings: { odds: "+999", available: true, lastUpdatedAt: "" } } }),
      ]),
    )!;
    const gameLines = game.categories.find((c) => c.key === "game_lines")!;
    const fullGame = gameLines.marketGroups.find((g) => g.marketType === "moneyline" && g.segment === null)!;
    expect(fullGame.selections).toHaveLength(1);
    expect(fullGame.selections[0].priceAmerican).toBe(150);
    expect(gameLines.marketGroups.find((g) => g.segment === "some_unconfirmed_period")).toBeDefined();
  });
});

describe("buildResearchGame -- expanded market coverage (Phase 2.19 follow-up)", () => {
  it("categorizes passing_attempts, passing_completions, and passing_interceptions under passing", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "att", statID: "passing_attempts", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "-127", overUnder: "30.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "cmp", statID: "passing_completions", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "+100", overUnder: "20.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "int", statID: "passing_interceptions", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "-105", overUnder: "0.5", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Drake Maye" } },
      ),
    )!;
    const passing = game.categories.find((c) => c.key === "passing")!;
    expect(passing.marketGroups.find((g) => g.marketType === "player_pass_attempts")).toBeDefined();
    expect(passing.marketGroups.find((g) => g.marketType === "player_completions")).toBeDefined();
    expect(passing.marketGroups.find((g) => g.marketType === "player_interceptions_thrown")).toBeDefined();
  });

  it("categorizes passing+rushing_yards under passing, distinct from rushing+receiving_yards", () => {
    const game = buildResearchGame(
      event(
        [odd({ oddID: "prc", statID: "passing+rushing_yards", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "-114", overUnder: "236.5", available: true, lastUpdatedAt: "" } } })],
        { P1: { playerID: "P1", name: "Drake Maye" } },
      ),
    )!;
    const passing = game.categories.find((c) => c.key === "passing")!;
    expect(passing.marketGroups.find((g) => g.marketType === "player_pass_rush_yards")).toBeDefined();
    expect(game.categories.find((c) => c.key === "rushing")).toBeUndefined();
  });

  it("categorizes rushing_attempts and rushing_longestRush under rushing", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "att", statID: "rushing_attempts", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "+106", overUnder: "5.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "lng", statID: "rushing_longestRush", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "-115", overUnder: "16.5", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Rhamondre Stevenson" } },
      ),
    )!;
    const rushing = game.categories.find((c) => c.key === "rushing")!;
    expect(rushing.marketGroups.find((g) => g.marketType === "player_rushing_attempts")).toBeDefined();
    expect(rushing.marketGroups.find((g) => g.marketType === "player_longest_rush")).toBeDefined();
  });

  it("categorizes receiving_longestReception under receiving", () => {
    const game = buildResearchGame(
      event(
        [odd({ oddID: "lng", statID: "receiving_longestReception", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { fanduel: { odds: "-118", overUnder: "22.5", available: true, lastUpdatedAt: "" } } })],
        { P1: { playerID: "P1", name: "Jaxon Smith-Njigba" } },
      ),
    )!;
    const receiving = game.categories.find((c) => c.key === "receiving")!;
    expect(receiving.marketGroups.find((g) => g.marketType === "player_longest_reception")).toBeDefined();
  });

  it("categorizes kicking_totalPoints, fieldGoals_made, and extraPoints_kicksMade under a new kicking category", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "tp", statID: "kicking_totalPoints", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "-115", overUnder: "6.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "fg", statID: "fieldGoals_made", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "+105", overUnder: "1.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "xp", statID: "extraPoints_kicksMade", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "-120", overUnder: "2.5", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Jason Myers" } },
      ),
    )!;
    const kicking = game.categories.find((c) => c.key === "kicking")!;
    expect(kicking).toBeDefined();
    expect(kicking.marketGroups.find((g) => g.marketType === "player_kicking_points")).toBeDefined();
    expect(kicking.marketGroups.find((g) => g.marketType === "player_field_goals_made")).toBeDefined();
    expect(kicking.marketGroups.find((g) => g.marketType === "player_extra_points_made")).toBeDefined();
  });

  it("categorizes defense_combinedTackles, defense_soloTackles, and defense_assistedTackles under a new defense category", () => {
    const game = buildResearchGame(
      event(
        [
          odd({ oddID: "ct", statID: "defense_combinedTackles", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "-110", overUnder: "7.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "st", statID: "defense_soloTackles", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "-105", overUnder: "4.5", available: true, lastUpdatedAt: "" } } }),
          odd({ oddID: "at", statID: "defense_assistedTackles", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "+100", overUnder: "1.5", available: true, lastUpdatedAt: "" } } }),
        ],
        { P1: { playerID: "P1", name: "Robert Spillane" } },
      ),
    )!;
    const defense = game.categories.find((c) => c.key === "defense")!;
    expect(defense).toBeDefined();
    expect(defense.marketGroups.find((g) => g.marketType === "player_total_tackles")).toBeDefined();
    expect(defense.marketGroups.find((g) => g.marketType === "player_solo_tackles")).toBeDefined();
    expect(defense.marketGroups.find((g) => g.marketType === "player_assisted_tackles")).toBeDefined();
  });

  it("drops defense_interceptions rather than guessing at its ambiguous real attribution", () => {
    const game = buildResearchGame(
      event(
        [odd({ oddID: "di", statID: "defense_interceptions", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: { draftkings: { odds: "+100", overUnder: "0.5", available: true, lastUpdatedAt: "" } } })],
      ),
    );
    expect(game).toBeNull();
  });

  it("drops team-level exotics with no clean Market/Side fit (firstToScore, bothTeamsScored, fantasyScore)", () => {
    const game = buildResearchGame(
      event([
        odd({ oddID: "fts", statID: "firstToScore", betTypeID: "ml", sideID: "away", byBookmaker: { fanduel: { odds: "+106", available: true, lastUpdatedAt: "" } } }),
        odd({ oddID: "bts", statID: "bothTeamsScored", betTypeID: "yn", sideID: "no", periodID: "1q", byBookmaker: { draftkings: { odds: "-150", available: true, lastUpdatedAt: "" } } }),
        odd({ oddID: "fs", statID: "fantasyScore", betTypeID: "ou", sideID: "over", playerID: "P1", byBookmaker: {} }),
      ]),
    );
    expect(game).toBeNull();
  });
});

describe("buildResearchGame -- drops unrecognized shapes rather than guessing", () => {
  it("returns null when every odd has an unrecognized statID", () => {
    const game = buildResearchGame(
      event([odd({ oddID: "x", statID: "totally_unrecognized_stat", betTypeID: "ou", sideID: "over", byBookmaker: { draftkings: { odds: "-110", available: true, lastUpdatedAt: "" } } })]),
    );
    expect(game).toBeNull();
  });

  it("drops a selection whose bookmaker entry has no odds available", () => {
    const game = buildResearchGame(
      event([odd({ oddID: "ml-away", statID: "points", betTypeID: "ml", sideID: "away", byBookmaker: { draftkings: { odds: "+150", available: false, lastUpdatedAt: "" } } })]),
    );
    expect(game).toBeNull();
  });
});

describe("summarizeSchedule", () => {
  it("tags every game with source: sportsgameodds", () => {
    const summaries = summarizeSchedule([event([])]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].source).toBe("sportsgameodds");
    expect(summaries[0].homeTeam).toBe("Seattle Seahawks");
  });
});
