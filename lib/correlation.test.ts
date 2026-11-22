import { describe, expect, it } from "vitest";

import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";

import { correlationsWith, findCorrelations, resolvePlayerTeam, type CorrelationLeg } from "./correlation";

const NYJ = "New York Jets";
const NE = "New England Patriots";

function leg(over: Partial<CorrelationLeg>): CorrelationLeg {
  return {
    owner: "X",
    homeTeam: NE,
    awayTeam: NYJ,
    market: Market.MONEYLINE,
    side: Side.AWAY,
    teamSide: null,
    playerName: null,
    propType: null,
    playerTeam: null,
    summary: "",
    ...over,
  };
}

const jetsML = leg({ owner: "Dave", market: Market.MONEYLINE, side: Side.AWAY });
const patsML = leg({ owner: "Cam", market: Market.MONEYLINE, side: Side.HOME });
const jetsSpread = leg({ owner: "Mike", market: Market.SPREAD, side: Side.AWAY });
const over = leg({ owner: "Cam", market: Market.TOTAL, side: Side.OVER });
const under = leg({ owner: "Cam", market: Market.TOTAL, side: Side.UNDER });
const jetsQB = leg({ owner: "Damon", market: Market.PLAYER_PROP, side: Side.OVER, playerName: "Justin Fields", propType: "Passing Yards", playerTeam: NYJ });
const jetsWR = leg({ owner: "Mike", market: Market.PLAYER_PROP, side: Side.OVER, playerName: "Garrett Wilson", propType: "Receiving Yards", playerTeam: NYJ });
const patsWRTD = leg({ owner: "Mike", market: Market.PLAYER_PROP_YESNO, side: Side.YES, playerName: "Stefon Diggs", propType: "Anytime TD", playerTeam: NE });

const dir = (a: CorrelationLeg, b: CorrelationLeg) => findCorrelations([a, b])[0]?.direction;

describe("findCorrelations", () => {
  it("same team ML + spread hit together", () => expect(dir(jetsML, jetsSpread)).toBe("together"));
  it("opposite teams' moneylines work against each other", () => expect(dir(jetsML, patsML)).toBe("against"));
  it("a team's win and its own player's over hit together", () => expect(dir(jetsML, jetsWR)).toBe("together"));
  it("a team's win and the other team's player scoring work against each other", () => expect(dir(jetsML, patsWRTD)).toBe("against"));
  it("game over + player over hit together; under + player over work against", () => {
    expect(dir(over, jetsWR)).toBe("together");
    expect(dir(under, jetsWR)).toBe("against");
  });
  it("QB passing + his own receiver hit together", () => expect(dir(jetsQB, jetsWR)).toBe("together"));
  it("team total over + the team's ML hit together; under works against", () => {
    expect(dir(jetsML, leg({ market: Market.TEAM_TOTAL, side: Side.OVER, teamSide: TeamSide.AWAY }))).toBe("together");
    expect(dir(jetsML, leg({ market: Market.TEAM_TOTAL, side: Side.UNDER, teamSide: TeamSide.AWAY }))).toBe("against");
  });
  it("a player prop with no known team is just flagged as same game", () => {
    expect(dir(jetsML, { ...jetsWR, playerTeam: null })).toBe("sameGame");
  });
  it("never flags legs in different games", () => {
    expect(findCorrelations([jetsML, leg({ homeTeam: "Buffalo Bills", awayTeam: "Miami Dolphins" })])).toEqual([]);
  });
  it("matches the same game when home/away are listed the other way round", () => {
    expect(dir(jetsML, { ...jetsSpread, homeTeam: NYJ, awayTeam: NE, side: Side.HOME })).toBe("together");
  });
  it("finds every pair in a four-leg Jets cluster", () => {
    expect(findCorrelations([jetsML, jetsSpread, jetsQB, jetsWR]).map((c) => c.direction)).toEqual(Array(6).fill("together"));
  });
});

describe("correlationsWith / resolvePlayerTeam", () => {
  it("compares a candidate only against the others", () => {
    expect(correlationsWith(jetsWR, [jetsML, leg({ homeTeam: "Buffalo Bills", awayTeam: "Miami Dolphins" })])).toHaveLength(1);
  });
  it("resolves a player's team from the game's roster, tolerating name punctuation", () => {
    const rosters = [{ homeTeam: NE, awayTeam: NYJ, players: { garrettwilson: NYJ } }];
    expect(resolvePlayerTeam(rosters, { homeTeam: NYJ, awayTeam: NE }, "Garrett Wilson")).toBe(NYJ);
    expect(resolvePlayerTeam(rosters, { homeTeam: NE, awayTeam: NYJ }, "Nobody")).toBeNull();
  });
});
