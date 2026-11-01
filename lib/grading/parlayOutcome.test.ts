import { describe, expect, it } from "vitest";

import { Badge, LegResult } from "@/app/generated/prisma/enums";

import { parlayOutcome } from "./parlayOutcome";

const leg = (result: LegResult, badge: Badge = Badge.NONE) => ({ result, badge });
const { WIN, LOSS, PUSH } = LegResult;

describe("parlayOutcome", () => {
  it("a winning parlay is a win", () => {
    expect(parlayOutcome(WIN, [leg(WIN, Badge.MONEYBAG), leg(WIN, Badge.MONEYBAG)])).toBe("win");
  });
  it("one losing leg in an otherwise-winning parlay is a lone loss", () => {
    expect(parlayOutcome(LOSS, [leg(WIN, Badge.MONEYBAG), leg(WIN, Badge.MONEYBAG), leg(LOSS, Badge.TOILET)])).toBe("loneLoss");
  });
  it("only one leg hitting is a lone win", () => {
    expect(parlayOutcome(LOSS, [leg(WIN, Badge.CROSS), leg(LOSS, Badge.POO), leg(LOSS, Badge.POO)])).toBe("loneWin");
  });
  it("nobody hitting is a reverse, pushes ignored", () => {
    expect(parlayOutcome(LOSS, [leg(LOSS, Badge.POO), leg(LOSS, Badge.POO), leg(PUSH)])).toBe("reverse");
  });
  it("a split loss is a plain loss", () => {
    expect(parlayOutcome(LOSS, [leg(WIN, Badge.MONEYBAG), leg(WIN, Badge.MONEYBAG), leg(LOSS, Badge.POO), leg(LOSS, Badge.POO)])).toBe("loss");
  });
  it("a single decided losing leg is a plain loss, not a reverse", () => {
    expect(parlayOutcome(LOSS, [leg(LOSS, Badge.POO), leg(PUSH)])).toBe("loss");
  });
});
