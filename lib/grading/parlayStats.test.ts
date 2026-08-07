import { describe, expect, it } from "vitest";

import { LegResult } from "@/app/generated/prisma/enums";

import {
  americanToDecimal,
  computeCombinedOdds,
  computeCurrentStreak,
  computeProfit,
  decimalToAmerican,
} from "./parlayStats";

describe("americanToDecimal / decimalToAmerican", () => {
  it("converts positive American odds to decimal", () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5);
  });

  it("converts negative American odds to decimal", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
  });

  it("round-trips decimal back to American", () => {
    expect(decimalToAmerican(2.5)).toBeCloseTo(150);
    expect(decimalToAmerican(1.9090909)).toBeCloseTo(-110, 0);
  });
});

describe("computeCombinedOdds", () => {
  it("multiplies decimal odds across all legs", () => {
    const legs = [
      { priceAtPick: -110, result: LegResult.WIN },
      { priceAtPick: -110, result: LegResult.WIN },
    ];
    // 1.909... * 1.909... ~= 3.645
    expect(computeCombinedOdds(legs)).toBeCloseTo(3.645, 2);
  });

  it("excludes push legs from the calculation entirely", () => {
    const withPush = computeCombinedOdds([
      { priceAtPick: -110, result: LegResult.WIN },
      { priceAtPick: -110, result: LegResult.PUSH },
    ]);
    const withoutPush = computeCombinedOdds([{ priceAtPick: -110, result: LegResult.WIN }]);
    expect(withPush).toBeCloseTo(withoutPush!, 5);
  });

  it("returns null if any counted leg has no price", () => {
    const legs = [
      { priceAtPick: -110, result: LegResult.WIN },
      { priceAtPick: null, result: LegResult.LOSS },
    ];
    expect(computeCombinedOdds(legs)).toBeNull();
  });

  it("returns null for an all-push parlay (nothing left to price)", () => {
    expect(computeCombinedOdds([{ priceAtPick: -110, result: LegResult.PUSH }])).toBeNull();
  });
});

describe("computeProfit", () => {
  it("computes profit on top of the stake, not total payout", () => {
    expect(computeProfit(10, 2.5)).toBeCloseTo(15);
  });
});

describe("computeCurrentStreak", () => {
  it("returns null for an empty history", () => {
    expect(computeCurrentStreak([])).toBeNull();
  });

  it("counts a run of wins ending at the most recent parlay", () => {
    const results = [LegResult.LOSS, LegResult.WIN, LegResult.WIN, LegResult.WIN];
    expect(computeCurrentStreak(results)).toEqual({ result: LegResult.WIN, count: 3 });
  });

  it("counts a run of losses ending at the most recent parlay", () => {
    const results = [LegResult.WIN, LegResult.WIN, LegResult.LOSS];
    expect(computeCurrentStreak(results)).toEqual({ result: LegResult.LOSS, count: 1 });
  });

  it("a single resolved parlay is a streak of one", () => {
    expect(computeCurrentStreak([LegResult.WIN])).toEqual({ result: LegResult.WIN, count: 1 });
  });
});
