import { LegResult, Market, Side, TeamSide } from "@/app/generated/prisma/enums";

import { resolvePropStatMapping } from "./statLabels";
import type { PropStatMapping } from "./statLabels";
import type { BoxScore } from "./types";

export type ResolveLegResult = { result: LegResult } | { result: undefined; reason: "pending" | "unmappable" };

const PENDING: ResolveLegResult = { result: undefined, reason: "pending" };
const UNMAPPABLE: ResolveLegResult = { result: undefined, reason: "unmappable" };

function extractStatValue(raw: string | undefined, extract?: "numerator" | "denominator"): number | null {
  if (raw === undefined || raw === "") return null;
  if (extract) {
    const part = raw.split("/")[extract === "numerator" ? 0 : 1];
    if (part === undefined) return null;
    const n = Number(part);
    return Number.isNaN(n) ? null : n;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

// Sums every stat this mapping references (missing individual entries count as 0 -- e.g.
// a WR with no rushing attempts still has real receiving stats, "0 rushing yards" is
// correct, not missing data).
function sumMapping(mapping: PropStatMapping, playerStats: Map<string, string>): number {
  return mapping.reduce((sum, ref) => {
    const value = extractStatValue(playerStats.get(`${ref.group}.${ref.key}`), ref.extract);
    return sum + (value ?? 0);
  }, 0);
}

// The core asymmetric rule the whole feature hinges on: a counting stat (game total,
// player prop) only ever goes UP, so the instant it exceeds the line, the OVER side is a
// guaranteed win and UNDER a guaranteed loss, regardless of what happens the rest of the
// game. But a value sitting AT OR BELOW the line always has room to still rise and cross
// it before the game ends -- UNDER and PUSH can only ever be decided once the game is
// FINAL. This is not symmetric ("either side can clinch early") -- only the side that's
// already been overshot is safe to call early.
function resolveOverUnder(current: number, line: number, side: Side, completed: boolean): LegResult | undefined {
  if (current > line) return side === Side.OVER ? LegResult.WIN : LegResult.LOSS;
  if (!completed) return undefined;
  if (current === line) return LegResult.PUSH;
  return side === Side.OVER ? LegResult.LOSS : LegResult.WIN;
}

function resolvePlayerStat(
  league: string,
  playerName: string | null,
  propType: string | null,
  box: BoxScore,
): { current: number; mapping: PropStatMapping } | "unmappable" | "no-data" {
  if (!playerName || !propType) return "unmappable";
  const mapping = resolvePropStatMapping(league, propType);
  if (!mapping) return "unmappable";

  const playerStats = box.playerStats.get(playerName.trim().toLowerCase());
  // Player not found at all in the box score -- could mean they truly have zero stats, or
  // could mean a name-matching mismatch (nickname, suffix, typo). Can't tell which, so
  // this always stays PENDING rather than risk confidently grading off a bad match --
  // manual resolve is the fallback, same principle as everywhere else in this feature.
  if (!playerStats) return "no-data";

  return { current: sumMapping(mapping, playerStats), mapping };
}

// Pure function, no I/O -- given one leg's pick fields and the game's current box score,
// returns a definite result, or `undefined` with a reason ("pending" = check back later,
// "unmappable" = this one can't be auto-graded at all, needs manual entry).
export function resolveLeg(
  leg: {
    market: Market;
    side: Side;
    lineAtPick: number | null;
    playerName: string | null;
    propType: string | null;
    teamSide: TeamSide | null;
  },
  box: BoxScore,
  league: string,
): ResolveLegResult {
  switch (leg.market) {
    case Market.MONEYLINE: {
      if (!box.status.completed || box.homeScore === null || box.awayScore === null) return PENDING;
      if (box.homeScore === box.awayScore) return { result: LegResult.PUSH };
      const won = leg.side === Side.HOME ? box.homeScore > box.awayScore : box.awayScore > box.homeScore;
      return { result: won ? LegResult.WIN : LegResult.LOSS };
    }

    case Market.SPREAD: {
      if (!box.status.completed || box.homeScore === null || box.awayScore === null || leg.lineAtPick === null) {
        return PENDING;
      }
      const [pickedScore, opponentScore] =
        leg.side === Side.HOME ? [box.homeScore, box.awayScore] : [box.awayScore, box.homeScore];
      const adjusted = pickedScore + leg.lineAtPick;
      if (adjusted === opponentScore) return { result: LegResult.PUSH };
      return { result: adjusted > opponentScore ? LegResult.WIN : LegResult.LOSS };
    }

    case Market.TOTAL: {
      if (box.homeScore === null || box.awayScore === null || leg.lineAtPick === null) return PENDING;
      const current = box.homeScore + box.awayScore;
      const result = resolveOverUnder(current, leg.lineAtPick, leg.side, box.status.completed);
      return result === undefined ? PENDING : { result };
    }

    case Market.TEAM_TOTAL: {
      if (box.homeScore === null || box.awayScore === null || leg.lineAtPick === null || !leg.teamSide) return PENDING;
      const current = leg.teamSide === TeamSide.HOME ? box.homeScore : box.awayScore;
      const result = resolveOverUnder(current, leg.lineAtPick, leg.side, box.status.completed);
      return result === undefined ? PENDING : { result };
    }

    case Market.PLAYER_PROP: {
      if (leg.lineAtPick === null) return UNMAPPABLE;
      const resolved = resolvePlayerStat(league, leg.playerName, leg.propType, box);
      if (resolved === "unmappable") return UNMAPPABLE;
      if (resolved === "no-data") return PENDING;
      const result = resolveOverUnder(resolved.current, leg.lineAtPick, leg.side, box.status.completed);
      return result === undefined ? PENDING : { result };
    }

    case Market.PLAYER_PROP_YESNO: {
      const resolved = resolvePlayerStat(league, leg.playerName, leg.propType, box);
      if (resolved === "unmappable") return UNMAPPABLE;
      if (resolved === "no-data") return PENDING;
      const occurred = resolved.current > 0;
      if (occurred) return { result: leg.side === Side.YES ? LegResult.WIN : LegResult.LOSS };
      if (!box.status.completed) return PENDING;
      return { result: leg.side === Side.YES ? LegResult.LOSS : LegResult.WIN };
    }

    default:
      return UNMAPPABLE;
  }
}
