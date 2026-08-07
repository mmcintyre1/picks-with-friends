import { describe, expect, it } from "vitest";

import { Market, Side } from "@/app/generated/prisma/enums";

import {
  mapPropOutcomeToLegFields,
  mapTeamOutcomeToLegFields,
  pickPreferredBookmaker,
} from "./mapping";
import type { ProviderGame } from "./types";

describe("mapTeamOutcomeToLegFields", () => {
  it("maps h2h to MONEYLINE, home side", () => {
    expect(mapTeamOutcomeToLegFields("h2h", { name: "Chiefs", price: -150 }, "Chiefs")).toEqual({
      market: Market.MONEYLINE,
      side: Side.HOME,
      line: null,
    });
  });

  it("maps h2h to MONEYLINE, away side", () => {
    expect(mapTeamOutcomeToLegFields("h2h", { name: "Broncos", price: 130 }, "Chiefs")).toEqual({
      market: Market.MONEYLINE,
      side: Side.AWAY,
      line: null,
    });
  });

  it("maps spreads to SPREAD with the outcome's own point", () => {
    expect(mapTeamOutcomeToLegFields("spreads", { name: "Chiefs", price: -110, point: -3.5 }, "Chiefs")).toEqual({
      market: Market.SPREAD,
      side: Side.HOME,
      line: -3.5,
    });
  });

  it("maps totals Over/Under to TOTAL", () => {
    expect(mapTeamOutcomeToLegFields("totals", { name: "Over", price: -110, point: 47.5 }, "Chiefs")).toEqual({
      market: Market.TOTAL,
      side: Side.OVER,
      line: 47.5,
    });
    expect(mapTeamOutcomeToLegFields("totals", { name: "Under", price: -110, point: 47.5 }, "Chiefs")).toEqual({
      market: Market.TOTAL,
      side: Side.UNDER,
      line: 47.5,
    });
  });

  it("returns null for an unrecognized market key", () => {
    expect(mapTeamOutcomeToLegFields("player_pass_yds", { name: "Over", price: -110 }, "Chiefs")).toBeNull();
  });
});

describe("mapPropOutcomeToLegFields", () => {
  it("maps an over/under prop market", () => {
    expect(
      mapPropOutcomeToLegFields("player_pass_yds", {
        name: "Over",
        price: -115,
        point: 275.5,
        description: "Patrick Mahomes",
      }),
    ).toEqual({
      market: Market.PLAYER_PROP,
      side: Side.OVER,
      line: 275.5,
      playerName: "Patrick Mahomes",
      propType: "Passing Yards",
    });
  });

  it("maps a yes/no prop market", () => {
    expect(
      mapPropOutcomeToLegFields("player_anytime_td", {
        name: "Yes",
        price: 145,
        description: "Christian McCaffrey",
      }),
    ).toEqual({
      market: Market.PLAYER_PROP_YESNO,
      side: Side.YES,
      line: null,
      playerName: "Christian McCaffrey",
      propType: "Anytime TD",
    });
  });

  it("returns null for an unrecognized market key", () => {
    expect(mapPropOutcomeToLegFields("h2h", { name: "Chiefs", price: -150 })).toBeNull();
  });

  it("returns null when the outcome has no player name", () => {
    expect(mapPropOutcomeToLegFields("player_pass_yds", { name: "Over", price: -115, point: 275.5 })).toBeNull();
  });
});

describe("pickPreferredBookmaker", () => {
  function game(keys: string[]): Pick<ProviderGame, "bookmakers"> {
    return { bookmakers: keys.map((key) => ({ key, title: key, lastUpdate: "", markets: [] })) };
  }

  it("prefers draftkings when present", () => {
    expect(pickPreferredBookmaker(game(["fanduel", "draftkings", "betmgm"]))?.key).toBe("draftkings");
  });

  it("falls back to the next priority bookmaker when draftkings is absent", () => {
    expect(pickPreferredBookmaker(game(["betmgm", "fanduel"]))?.key).toBe("fanduel");
  });

  it("falls back to the first available bookmaker when none are in the priority list", () => {
    expect(pickPreferredBookmaker(game(["pointsbet"]))?.key).toBe("pointsbet");
  });

  it("returns null when there are no bookmakers", () => {
    expect(pickPreferredBookmaker(game([]))).toBeNull();
  });
});
