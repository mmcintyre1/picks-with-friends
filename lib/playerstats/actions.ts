"use server";

import { getRostersForGame } from "@/lib/rosters/actions";
import { LEAGUE_ESPN_PATHS } from "@/lib/rosters/leagues";

import { extractGameLog, gamelogStatKeys, normalizePlayerName } from "./gamelogStats";
import { getPlayerStatsProvider } from "./index";
import type { PlayerLogs, PlayerPropLog } from "./types";

// Returns each requested player's real recent game history for each requested propType, so
// the caller can compute hit rates for however many lines/tiers it's rendering without a
// round trip per line -- a 10-tier ladder is ten different lines judged against the exact
// same game log, so shipping the raw values once and comparing client-side is both cheaper
// and simpler than asking the server per tier.
//
// Deliberately forgiving throughout: a player whose name doesn't resolve to a roster entry, a
// propType with no confirmed game-log column, a position whose log lacks the needed stat, or
// one player's fetch failing outright all just mean *that* entry is absent from the result.
// This is supplementary context next to a line -- it must never break the pick flow, so there
// is no failure path here that surfaces an error for anything short of the league itself
// being unsupported.
export async function getPlayerPropLogs(
  league: string,
  homeTeam: string,
  awayTeam: string,
  requests: { playerName: string; propType: string }[],
): Promise<{ players: PlayerLogs[] } | { error: string }> {
  const sportPath = LEAGUE_ESPN_PATHS[league];
  if (!sportPath) return { error: `Player history isn't available for ${league}.` };

  const roster = await getRostersForGame(league, homeTeam, awayTeam);
  if ("error" in roster) return { error: roster.error };

  const athleteIdByName = new Map<string, string>();
  for (const player of roster.players) {
    if (player.athleteId) athleteIdByName.set(normalizePlayerName(player.name), player.athleteId);
  }

  // One game log per player, not per (player, propType) -- the same log answers every stat.
  const propTypesByPlayer = new Map<string, Set<string>>();
  for (const request of requests) {
    const set = propTypesByPlayer.get(request.playerName) ?? new Set<string>();
    set.add(request.propType);
    propTypesByPlayer.set(request.playerName, set);
  }

  const provider = getPlayerStatsProvider();
  const settled = await Promise.allSettled(
    [...propTypesByPlayer.entries()].map(async ([playerName, propTypes]): Promise<PlayerLogs | null> => {
      const athleteId = athleteIdByName.get(normalizePlayerName(playerName));
      if (!athleteId) return null;

      const response = await provider.getGameLog(sportPath, athleteId);
      const logs: PlayerPropLog[] = [];
      for (const propType of propTypes) {
        const statKeys = gamelogStatKeys(league, propType);
        if (!statKeys) continue;
        const entries = extractGameLog(response, statKeys);
        if (entries.length > 0) logs.push({ propType, entries });
      }
      return logs.length > 0 ? { playerName, athleteId, logs } : null;
    }),
  );

  const players = settled
    .filter((r): r is PromiseFulfilledResult<PlayerLogs | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((p): p is PlayerLogs => p !== null);

  return { players };
}
