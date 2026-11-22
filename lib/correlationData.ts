import { correlationsWith, findCorrelations, resolvePlayerTeam, type CorrelationLeg, type GameRoster } from "@/lib/correlation";
import { legSummary } from "@/lib/legSummary";
import { normalizePlayerName } from "@/lib/playerstats/gamelogStats";
import { withDeadline } from "@/lib/research/deadline";
import { getRostersForGame } from "@/lib/rosters/actions";
import { isRosterLeague } from "@/lib/rosters/leagues";
import type { Market, Side, TeamSide } from "@/app/generated/prisma/enums";

type LegRecord = {
  userId: string;
  market: Market;
  side: Side;
  teamSide: TeamSide | null;
  lineAtPick: number | null;
  playerName: string | null;
  propType: string | null;
  game: { homeTeam: string; awayTeam: string; league: string | null };
};

// Rosters for every game that already has a leg -- the only games a new pick could correlate
// with. ESPN is free and cached for hours; a slow lookup just means player teams stay unknown
// (those pairs fall back to "same game"), never a slow page.
export async function loadGameRosters(legs: LegRecord[]): Promise<GameRoster[]> {
  const games = new Map<string, LegRecord["game"]>();
  for (const leg of legs) {
    if (leg.game.league && isRosterLeague(leg.game.league)) games.set(`${leg.game.league}|${leg.game.homeTeam}|${leg.game.awayTeam}`, leg.game);
  }
  const results = await Promise.allSettled(
    [...games.values()].map(async (game): Promise<GameRoster | null> => {
      const r = await withDeadline(getRostersForGame(game.league!, game.homeTeam, game.awayTeam), 3000, "correlation roster");
      if ("error" in r) return null;
      const players: Record<string, string> = {};
      for (const p of r.players) players[normalizePlayerName(p.name)] = p.team;
      return { homeTeam: game.homeTeam, awayTeam: game.awayTeam, players };
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

export function toCorrelationLeg(leg: LegRecord, owner: string, rosters: GameRoster[]): CorrelationLeg {
  return {
    owner,
    homeTeam: leg.game.homeTeam,
    awayTeam: leg.game.awayTeam,
    market: leg.market,
    side: leg.side,
    teamSide: leg.teamSide,
    playerName: leg.playerName,
    propType: leg.propType,
    playerTeam: resolvePlayerTeam(rosters, leg.game, leg.playerName),
    summary: legSummary(leg, leg.game),
  };
}

export { correlationsWith, findCorrelations };
