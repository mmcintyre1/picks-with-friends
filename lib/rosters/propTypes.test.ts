import { describe, expect, it } from "vitest";

import { GENERIC_PROP_TYPES, propTypesForPosition } from "./propTypes";

describe("propTypesForPosition", () => {
  it("returns the generic list when no position is known yet", () => {
    expect(propTypesForPosition("NFL", undefined)).toEqual(GENERIC_PROP_TYPES);
  });

  it("gates NFL props by position", () => {
    expect(propTypesForPosition("NFL", "QB")).toContain("Passing Yards");
    expect(propTypesForPosition("NFL", "WR")).toContain("Receiving Yards");
    expect(propTypesForPosition("NFL", "WR")).not.toContain("Passing Yards");
  });

  it("gates NBA props by the coarse G/F/C position", () => {
    expect(propTypesForPosition("NBA", "G")).toContain("Assists");
    expect(propTypesForPosition("NBA", "C")).toContain("Blocks");
    expect(propTypesForPosition("NBA", "C")).not.toContain("Three-Pointers Made");
  });

  it("gates MLB props by pitcher vs. batter position", () => {
    expect(propTypesForPosition("MLB", "SP")).toContain("Strikeouts");
    expect(propTypesForPosition("MLB", "OF")).toContain("Home Runs");
    expect(propTypesForPosition("MLB", "OF")).not.toContain("Strikeouts");
  });

  it("gates NHL props, giving goalies a different set than skaters", () => {
    expect(propTypesForPosition("NHL", "C")).toContain("Goals");
    expect(propTypesForPosition("NHL", "G")).toEqual(["Saves", "Goals Against"]);
  });

  it("falls back to a minimal list for an unmapped position in a known league", () => {
    expect(propTypesForPosition("NFL", "OT")).toEqual(["Anytime TD"]);
  });

  it("falls back to a minimal list for a known position in a league with no roster support", () => {
    // Same contract as an unmapped position in a supported league -- "GK" isn't
    // recognized anywhere, so it gets the conservative fallback, not the NFL-flavored
    // generic list (that's reserved for "no position known yet at all").
    expect(propTypesForPosition("SOCCER", "GK")).toEqual(["Anytime TD"]);
  });

  it("falls back to the generic list when no league is recognized and no position is known", () => {
    expect(propTypesForPosition("SOCCER", undefined)).toEqual(GENERIC_PROP_TYPES);
  });
});
