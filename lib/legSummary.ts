import { Market, Side } from "@/app/generated/prisma/enums";

export function legSummary(
  leg: {
    market: Market;
    side: Side;
    lineAtPick: number | null;
    playerName?: string | null;
    propType?: string | null;
  },
  game: { homeTeam: string; awayTeam: string },
) {
  if (leg.market === Market.PLAYER_PROP) {
    return `${leg.playerName ?? "?"} (${leg.propType ?? "?"}) ${leg.side === Side.OVER ? "Over" : "Under"} ${leg.lineAtPick ?? "?"}`;
  }
  if (leg.market === Market.PLAYER_PROP_YESNO) {
    return `${leg.playerName ?? "?"} (${leg.propType ?? "?"}) — ${leg.side === Side.YES ? "Yes" : "No"}`;
  }
  if (leg.market === Market.MONEYLINE) {
    const team = leg.side === Side.HOME ? game.homeTeam : game.awayTeam;
    return `${team} ML`;
  }
  if (leg.market === Market.TOTAL) {
    return `${leg.side === Side.OVER ? "Over" : "Under"} ${leg.lineAtPick ?? "?"}`;
  }
  const team = leg.side === Side.HOME ? game.homeTeam : game.awayTeam;
  const line = leg.lineAtPick != null ? (leg.lineAtPick > 0 ? `+${leg.lineAtPick}` : `${leg.lineAtPick}`) : "";
  return `${team} ${line}`.trim();
}
