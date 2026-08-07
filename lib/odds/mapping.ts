import { Market, Side } from "@/app/generated/prisma/enums";

import type { ProviderBookmaker, ProviderGame, ProviderOutcome } from "./types";

// Starting set matches the examples used throughout the plan; extending this later is a
// one-line addition (e.g. player_pass_tds, player_receptions).
export const TEAM_PROP_MARKETS: Record<string, { label: string; shape: "overUnder" | "yesNo" }> = {
  player_pass_yds: { label: "Passing Yards", shape: "overUnder" },
  player_rush_yds: { label: "Rushing Yards", shape: "overUnder" },
  player_reception_yds: { label: "Receiving Yards", shape: "overUnder" },
  player_anytime_td: { label: "Anytime TD", shape: "yesNo" },
};

export const DEFAULT_PROP_MARKETS = Object.keys(TEAM_PROP_MARKETS);

export const BOOKMAKER_PRIORITY = ["draftkings", "fanduel", "betmgm", "caesars"];

export function pickPreferredBookmaker(
  game: Pick<ProviderGame, "bookmakers">,
): ProviderBookmaker | null {
  for (const key of BOOKMAKER_PRIORITY) {
    const found = game.bookmakers.find((b) => b.key === key);
    if (found) return found;
  }
  return game.bookmakers[0] ?? null;
}

export function mapTeamOutcomeToLegFields(
  marketKey: string,
  outcome: ProviderOutcome,
  homeTeam: string,
): { market: Market; side: Side; line: number | null } | null {
  if (marketKey === "h2h") {
    return {
      market: Market.MONEYLINE,
      side: outcome.name === homeTeam ? Side.HOME : Side.AWAY,
      line: null,
    };
  }
  if (marketKey === "spreads") {
    return {
      market: Market.SPREAD,
      side: outcome.name === homeTeam ? Side.HOME : Side.AWAY,
      line: outcome.point ?? null,
    };
  }
  if (marketKey === "totals") {
    return {
      market: Market.TOTAL,
      side: outcome.name === "Over" ? Side.OVER : Side.UNDER,
      line: outcome.point ?? null,
    };
  }
  return null;
}

export function mapPropOutcomeToLegFields(
  marketKey: string,
  outcome: ProviderOutcome,
): { market: Market; side: Side; line: number | null; playerName: string; propType: string } | null {
  const propDef = TEAM_PROP_MARKETS[marketKey];
  if (!propDef || !outcome.description) return null;

  if (propDef.shape === "yesNo") {
    return {
      market: Market.PLAYER_PROP_YESNO,
      side: outcome.name === "Yes" ? Side.YES : Side.NO,
      line: null,
      playerName: outcome.description,
      propType: propDef.label,
    };
  }
  return {
    market: Market.PLAYER_PROP,
    side: outcome.name === "Over" ? Side.OVER : Side.UNDER,
    line: outcome.point ?? null,
    playerName: outcome.description,
    propType: propDef.label,
  };
}
