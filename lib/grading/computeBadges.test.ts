import { describe, expect, it } from "vitest";

import { Badge, LegResult } from "@/app/generated/prisma/enums";

import { computeBadges } from "./computeBadges";

describe("computeBadges", () => {
  it("gives plain badges when all 4 legs agree", () => {
    const legs = [
      { id: "a", result: LegResult.WIN },
      { id: "b", result: LegResult.WIN },
      { id: "c", result: LegResult.WIN },
      { id: "d", result: LegResult.WIN },
    ];
    expect(computeBadges(legs)).toEqual({
      a: Badge.MONEYBAG,
      b: Badge.MONEYBAG,
      c: Badge.MONEYBAG,
      d: Badge.MONEYBAG,
    });
  });

  it("gives the lone loser a toilet in a 3-1 split", () => {
    const legs = [
      { id: "a", result: LegResult.WIN },
      { id: "b", result: LegResult.WIN },
      { id: "c", result: LegResult.WIN },
      { id: "d", result: LegResult.LOSS },
    ];
    expect(computeBadges(legs)).toEqual({
      a: Badge.MONEYBAG,
      b: Badge.MONEYBAG,
      c: Badge.MONEYBAG,
      d: Badge.TOILET,
    });
  });

  it("gives the lone winner a cross in a 3-1 split", () => {
    const legs = [
      { id: "a", result: LegResult.LOSS },
      { id: "b", result: LegResult.LOSS },
      { id: "c", result: LegResult.LOSS },
      { id: "d", result: LegResult.WIN },
    ];
    expect(computeBadges(legs)).toEqual({
      a: Badge.POO,
      b: Badge.POO,
      c: Badge.POO,
      d: Badge.CROSS,
    });
  });

  it("gives the lone loser a toilet in a 2-1 split (3-leg parlay)", () => {
    const legs = [
      { id: "a", result: LegResult.WIN },
      { id: "b", result: LegResult.WIN },
      { id: "c", result: LegResult.LOSS },
    ];
    expect(computeBadges(legs)).toEqual({
      a: Badge.MONEYBAG,
      b: Badge.MONEYBAG,
      c: Badge.TOILET,
    });
  });

  it("gives plain badges for a 1-1 split (2-leg parlay, no majority to be lone against)", () => {
    const legs = [
      { id: "a", result: LegResult.WIN },
      { id: "b", result: LegResult.LOSS },
    ];
    expect(computeBadges(legs)).toEqual({
      a: Badge.MONEYBAG,
      b: Badge.POO,
    });
  });

  it("ignores pushes for the lone-outlier determination and gives them no badge", () => {
    const legs = [
      { id: "a", result: LegResult.WIN },
      { id: "b", result: LegResult.WIN },
      { id: "c", result: LegResult.LOSS },
      { id: "d", result: LegResult.PUSH },
    ];
    expect(computeBadges(legs)).toEqual({
      a: Badge.MONEYBAG,
      b: Badge.MONEYBAG,
      c: Badge.TOILET,
      d: Badge.NONE,
    });
  });
});
