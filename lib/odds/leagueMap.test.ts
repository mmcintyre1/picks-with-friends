import { describe, expect, it } from "vitest";

import { toSportKeys } from "./leagueMap";

describe("toSportKeys", () => {
  it("maps NFL to both its preseason and regular-season sport keys", () => {
    expect(toSportKeys("NFL")).toEqual(["americanfootball_nfl_preseason", "americanfootball_nfl"]);
  });

  it("returns undefined for an unmapped league", () => {
    expect(toSportKeys("NBA")).toBeUndefined();
    expect(toSportKeys("Curling")).toBeUndefined();
  });
});
