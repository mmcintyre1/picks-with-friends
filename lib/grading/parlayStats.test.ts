import { describe, expect, it } from "vitest";

import { LegResult } from "@/app/generated/prisma/enums";

import {
  americanToDecimal,
  computeCombinedOdds,
  computeCurrentStreak,
  computeLongestStreak,
  computeProfit,
  decimalToAmerican,
  effectiveCombinedOdds,
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

describe("effectiveCombinedOdds", () => {
  const legs = [
    { priceAtPick: -110, result: LegResult.WIN },
    { priceAtPick: -110, result: LegResult.WIN },
  ];

  it("uses the computed value when there's no override", () => {
    expect(effectiveCombinedOdds(legs, null)).toBeCloseTo(computeCombinedOdds(legs)!, 5);
  });

  it("uses the manual override instead of the computed product when set", () => {
    // -150 American -> decimal 1.6667, nothing to do with the legs' own -110/-110 product.
    expect(effectiveCombinedOdds(legs, -150)).toBeCloseTo(americanToDecimal(-150), 5);
  });

  it("an override still applies even if the legs alone couldn't be priced (missing price)", () => {
    const legsMissingPrice = [{ priceAtPick: null, result: LegResult.WIN }];
    expect(computeCombinedOdds(legsMissingPrice)).toBeNull();
    expect(effectiveCombinedOdds(legsMissingPrice, 200)).toBeCloseTo(americanToDecimal(200), 5);
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

describe("computeLongestStreak", () => {
  it("returns 0 for an empty history", () => {
    expect(computeLongestStreak([], LegResult.WIN)).toBe(0);
  });

  it("finds the longest run even if it's not the trailing streak", () => {
    const results = [
      LegResult.WIN,
      LegResult.WIN,
      LegResult.WIN,
      LegResult.WIN,
      LegResult.LOSS,
      LegResult.WIN,
    ];
    expect(computeLongestStreak(results, LegResult.WIN)).toBe(4);
  });

  it("finds the longest losing run independent of the longest winning run", () => {
    const results = [LegResult.WIN, LegResult.LOSS, LegResult.LOSS, LegResult.LOSS, LegResult.WIN];
    expect(computeLongestStreak(results, LegResult.LOSS)).toBe(3);
    expect(computeLongestStreak(results, LegResult.WIN)).toBe(1);
  });

  it("returns 0 if the target result never occurs", () => {
    expect(computeLongestStreak([LegResult.WIN, LegResult.WIN], LegResult.LOSS)).toBe(0);
  });
});
