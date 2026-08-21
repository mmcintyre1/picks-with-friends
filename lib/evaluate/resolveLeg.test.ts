import { describe, expect, it } from "vitest";

import { LegResult, Market, Side } from "@/app/generated/prisma/enums";

import { resolveLeg } from "./resolveLeg";
import type { BoxScore } from "./types";

function box(overrides: Partial<BoxScore> = {}): BoxScore {
  return {
    status: { state: "in", completed: false, detail: "" },
    homeScore: null,
    awayScore: null,
    playerStats: new Map(),
    ...overrides,
  };
}

const baseLeg = {
  market: Market.TOTAL,
  side: Side.OVER,
  lineAtPick: null as number | null,
  playerName: null as string | null,
  propType: null as string | null,
};

describe("resolveLeg -- TOTAL", () => {
  it("clinches OVER early once the combined score exceeds the line", () => {
    const result = resolveLeg(
      { ...baseLeg, side: Side.OVER, lineAtPick: 45.5 },
      box({ homeScore: 24, awayScore: 22, status: { state: "in", completed: false, detail: "Q3" } }),
      "NFL",
    );
    expect(result).toEqual({ result: LegResult.WIN });
  });

  it("clinches UNDER (the other side of that same crossed line) as a loss at the same moment", () => {
    const result = resolveLeg(
      { ...baseLeg, side: Side.UNDER, lineAtPick: 45.5 },
      box({ homeScore: 24, awayScore: 22, status: { state: "in", completed: false, detail: "Q3" } }),
      "NFL",
    );
    expect(result).toEqual({ result: LegResult.LOSS });
  });

  it("stays pending pre-final when the current total is still below the line", () => {
    const result = resolveLeg(
      { ...baseLeg, side: Side.OVER, lineAtPick: 45.5 },
      box({ homeScore: 10, awayScore: 7, status: { state: "in", completed: false, detail: "Q2" } }),
      "NFL",
    );
    expect(result).toEqual({ result: undefined, reason: "pending" });
  });

  it("stays pending pre-final when the current total sits exactly on the line (could still push or cross)", () => {
    const result = resolveLeg(
      { ...baseLeg, side: Side.UNDER, lineAtPick: 45 },
      box({ homeScore: 20, awayScore: 25, status: { state: "in", completed: false, detail: "Q4" } }),
      "NFL",
    );
    expect(result).toEqual({ result: undefined, reason: "pending" });
  });

  it("resolves OVER/UNDER/PUSH correctly once final", () => {
    const final = (home: number, away: number) =>
      box({ homeScore: home, awayScore: away, status: { state: "post", completed: true, detail: "Final" } });

    expect(resolveLeg({ ...baseLeg, side: Side.OVER, lineAtPick: 45 }, final(20, 30), "NFL")).toEqual({
      result: LegResult.WIN,
    });
    expect(resolveLeg({ ...baseLeg, side: Side.UNDER, lineAtPick: 45 }, final(20, 30), "NFL")).toEqual({
      result: LegResult.LOSS,
    });
    expect(resolveLeg({ ...baseLeg, side: Side.OVER, lineAtPick: 45 }, final(20, 20), "NFL")).toEqual({
      result: LegResult.LOSS,
    });
    expect(resolveLeg({ ...baseLeg, side: Side.UNDER, lineAtPick: 45 }, final(20, 20), "NFL")).toEqual({
      result: LegResult.WIN,
    });
    expect(resolveLeg({ ...baseLeg, side: Side.OVER, lineAtPick: 40 }, final(20, 20), "NFL")).toEqual({
      result: LegResult.PUSH,
    });
  });
});

describe("resolveLeg -- PLAYER_PROP", () => {
  const propBox = (yards: string, completed = false) =>
    box({
      status: { state: completed ? "post" : "in", completed, detail: "" },
      playerStats: new Map([["patrick mahomes", new Map([["passing.passingYards", yards]])]]),
    });

  it("clinches OVER early once the stat exceeds the line", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.OVER, lineAtPick: 249.5, playerName: "Patrick Mahomes", propType: "Passing Yards" };
    expect(resolveLeg(leg, propBox("310"), "NFL")).toEqual({ result: LegResult.WIN });
  });

  it("stays pending below the line even at final if that specific case weren't final -- and resolves once final", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.UNDER, lineAtPick: 249.5, playerName: "Patrick Mahomes", propType: "Passing Yards" };
    expect(resolveLeg(leg, propBox("200"), "NFL")).toEqual({ result: undefined, reason: "pending" });
    expect(resolveLeg(leg, propBox("200", true), "NFL")).toEqual({ result: LegResult.WIN });
  });

  it("sums a multi-stat mapping (Rush + Rec Yards)", () => {
    const combo = box({
      status: { state: "post", completed: true, detail: "Final" },
      playerStats: new Map([
        [
          "christian mccaffrey",
          new Map([
            ["rushing.rushingYards", "80"],
            ["receiving.receivingYards", "45"],
          ]),
        ],
      ]),
    });
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.OVER, lineAtPick: 100.5, playerName: "Christian McCaffrey", propType: "Rush + Rec Yards" };
    expect(resolveLeg(leg, combo, "NFL")).toEqual({ result: LegResult.WIN });
  });

  it("extracts a numerator from a compound completions/attempts stat", () => {
    const b = box({
      status: { state: "post", completed: true, detail: "Final" },
      playerStats: new Map([["patrick mahomes", new Map([["passing.completions/passingAttempts", "26/34"]])]]),
    });
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.OVER, lineAtPick: 22.5, playerName: "Patrick Mahomes", propType: "Completions" };
    expect(resolveLeg(leg, b, "NFL")).toEqual({ result: LegResult.WIN });
  });

  it("returns unmappable for a propType with no mapping (free-typed or unsupported)", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.OVER, lineAtPick: 5, playerName: "Someone", propType: "Made-up Stat" };
    expect(resolveLeg(leg, propBox("10", true), "NFL")).toEqual({ result: undefined, reason: "unmappable" });
  });

  it("returns unmappable for a league with no verified stat mapping (NBA/NHL, off-season, deliberately unmapped)", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.OVER, lineAtPick: 20.5, playerName: "Someone", propType: "Points" };
    expect(resolveLeg(leg, propBox("25", true), "NBA")).toEqual({ result: undefined, reason: "unmappable" });
  });

  it("stays pending (not unmappable, not a confident zero) when the player isn't found in the box score at all, even at final", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP, side: Side.OVER, lineAtPick: 10, playerName: "Nobody Here", propType: "Passing Yards" };
    expect(resolveLeg(leg, propBox("999", true), "NFL")).toEqual({ result: undefined, reason: "pending" });
  });
});

describe("resolveLeg -- PLAYER_PROP_YESNO", () => {
  const tdBox = (rushingTds: string, completed = false) =>
    box({
      status: { state: completed ? "post" : "in", completed, detail: "" },
      playerStats: new Map([["isiah pacheco", new Map([["rushing.rushingTouchdowns", rushingTds]])]]),
    });

  it("clinches YES the instant the stat occurs, pre-final", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP_YESNO, side: Side.YES, playerName: "Isiah Pacheco", propType: "Anytime TD" };
    expect(resolveLeg(leg, tdBox("1"), "NFL")).toEqual({ result: LegResult.WIN });
  });

  it("clinches NO as a loss at that same instant", () => {
    const leg = { ...baseLeg, market: Market.PLAYER_PROP_YESNO, side: Side.NO, playerName: "Isiah Pacheco", propType: "Anytime TD" };
    expect(resolveLeg(leg, tdBox("1"), "NFL")).toEqual({ result: LegResult.LOSS });
  });

  it("stays pending pre-final while it hasn't happened yet, resolves NO/YES correctly once final", () => {
    const yesLeg = { ...baseLeg, market: Market.PLAYER_PROP_YESNO, side: Side.YES, playerName: "Isiah Pacheco", propType: "Anytime TD" };
    const noLeg = { ...baseLeg, market: Market.PLAYER_PROP_YESNO, side: Side.NO, playerName: "Isiah Pacheco", propType: "Anytime TD" };
    expect(resolveLeg(yesLeg, tdBox("0"), "NFL")).toEqual({ result: undefined, reason: "pending" });
    expect(resolveLeg(yesLeg, tdBox("0", true), "NFL")).toEqual({ result: LegResult.LOSS });
    expect(resolveLeg(noLeg, tdBox("0", true), "NFL")).toEqual({ result: LegResult.WIN });
  });
});

describe("resolveLeg -- SPREAD and MONEYLINE (deliberately final-only, no early clinch)", () => {
  it("SPREAD stays pending pre-final regardless of margin, including a blowout -- no early heuristic sneaks in", () => {
    const leg = { ...baseLeg, market: Market.SPREAD, side: Side.HOME, lineAtPick: -3.5 };
    const blowout = box({ homeScore: 45, awayScore: 3, status: { state: "in", completed: false, detail: "Q4 0:30" } });
    expect(resolveLeg(leg, blowout, "NFL")).toEqual({ result: undefined, reason: "pending" });
  });

  it("SPREAD grades correctly once final (covers, doesn't cover, exact push)", () => {
    const final = (home: number, away: number) =>
      box({ homeScore: home, awayScore: away, status: { state: "post", completed: true, detail: "Final" } });
    expect(resolveLeg({ ...baseLeg, market: Market.SPREAD, side: Side.HOME, lineAtPick: -3.5 }, final(24, 20), "NFL")).toEqual({ result: LegResult.WIN });
    expect(resolveLeg({ ...baseLeg, market: Market.SPREAD, side: Side.HOME, lineAtPick: -3.5 }, final(23, 20), "NFL")).toEqual({ result: LegResult.LOSS });
    expect(resolveLeg({ ...baseLeg, market: Market.SPREAD, side: Side.HOME, lineAtPick: -3 }, final(23, 20), "NFL")).toEqual({ result: LegResult.PUSH });
  });

  it("MONEYLINE stays pending pre-final regardless of margin", () => {
    const leg = { ...baseLeg, market: Market.MONEYLINE, side: Side.HOME, lineAtPick: null };
    const blowout = box({ homeScore: 45, awayScore: 3, status: { state: "in", completed: false, detail: "Q4 0:30" } });
    expect(resolveLeg(leg, blowout, "NFL")).toEqual({ result: undefined, reason: "pending" });
  });

  it("MONEYLINE grades correctly once final, including a tie as a push", () => {
    const final = (home: number, away: number) =>
      box({ homeScore: home, awayScore: away, status: { state: "post", completed: true, detail: "Final" } });
    expect(resolveLeg({ ...baseLeg, market: Market.MONEYLINE, side: Side.HOME, lineAtPick: null }, final(24, 20), "NFL")).toEqual({ result: LegResult.WIN });
    expect(resolveLeg({ ...baseLeg, market: Market.MONEYLINE, side: Side.AWAY, lineAtPick: null }, final(24, 20), "NFL")).toEqual({ result: LegResult.LOSS });
    expect(resolveLeg({ ...baseLeg, market: Market.MONEYLINE, side: Side.HOME, lineAtPick: null }, final(20, 20), "NFL")).toEqual({ result: LegResult.PUSH });
  });
});
