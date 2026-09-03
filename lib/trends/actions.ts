"use server";

import type { TrackedGame } from "@/app/generated/prisma/client";
import { getBoxScoreProvider } from "@/lib/evaluate";
import { BoxScoreProviderError } from "@/lib/evaluate/types";
import { prisma } from "@/lib/prisma";
import { LEAGUE_ESPN_PATHS } from "@/lib/rosters/leagues";
import { matchEspnEvent } from "@/lib/schedule/matchEspnEvent";

import { evaluateGame, summarizeTrend, type TeamTrend } from "./computeTrend";

// How many of a team's most recent tracked games to consider -- bounded so a team with a
// long tracked history doesn't turn every trend read into an ever-growing query, and so an
// old, stale-by-then game doesn't keep counting toward a "recent form" read forever.
const RECENT_GAMES_LIMIT = 30;

// Best-effort real final-score backfill for one tracked game that's already past kickoff
// with no score yet -- resolves (and caches) a real ESPN event id via the same free-schedule
// matcher app/parlays/actions.ts's evaluateParlay uses, then fetches the real box score
// (lib/evaluate/, already built and tested for auto-grading -- no new provider code here).
// Never throws: one game's fetch failing (not_found/upstream_error, or no schedule match at
// all) must never block computing a trend from every other game that's already fully known.
async function backfillScore(row: TrackedGame): Promise<{ homeScore: number; awayScore: number } | null> {
  try {
    const espnEventId = row.espnEventId ?? (await matchEspnEvent(row.league, row.homeTeam, row.awayTeam, row.commenceTime));
    if (!espnEventId) return null;

    const sportPath = LEAGUE_ESPN_PATHS[row.league];
    if (!sportPath) return null;

    const box = await getBoxScoreProvider().getBoxScore(sportPath, espnEventId);
    if (!box.status.completed || box.homeScore === null || box.awayScore === null) {
      // Cache the resolved id even if the game isn't final yet, so the next read doesn't
      // re-search the schedule for a game we've already found once.
      if (!row.espnEventId) await prisma.trackedGame.update({ where: { id: row.id }, data: { espnEventId } });
      return null;
    }

    await prisma.trackedGame.update({
      where: { id: row.id },
      data: { espnEventId, homeScore: box.homeScore, awayScore: box.awayScore, completedAt: new Date() },
    });
    return { homeScore: box.homeScore, awayScore: box.awayScore };
  } catch (error) {
    if (error instanceof BoxScoreProviderError) return null;
    return null;
  }
}

// A team's free, app-owned ATS/O-U trend, built from tracked games this app has itself
// browsed the real pregame line for (see lib/trends/record.ts) plus their real final score
// (backfilled here, on read, rather than via a cron this app has no infrastructure for).
// Starts at zero sample size the day this ships and only grows from real usage going
// forward -- there is no way to backfill trend history from before this existed without
// paying a vendor for real historical odds (confirmed unaffordable at this app's scale, see
// the plan). Callers should treat a small sampleSize as "early, not broken."
export async function getTeamTrend(league: string, teamName: string): Promise<TeamTrend> {
  const rows = await prisma.trackedGame.findMany({
    where: { league, OR: [{ homeTeam: teamName }, { awayTeam: teamName }] },
    orderBy: { commenceTime: "desc" },
    take: RECENT_GAMES_LIMIT,
  });

  const now = Date.now();
  const needsBackfill = rows.filter((r) => (r.homeScore === null || r.awayScore === null) && r.commenceTime.getTime() < now);
  const backfilled = await Promise.all(needsBackfill.map((row) => backfillScore(row).then((result) => [row.id, result] as const)));
  const backfilledById = new Map(backfilled);

  const results = rows.flatMap((row) => {
    const fresh = backfilledById.get(row.id);
    const homeScore = row.homeScore ?? fresh?.homeScore ?? null;
    const awayScore = row.awayScore ?? fresh?.awayScore ?? null;
    if (homeScore === null || awayScore === null) return [];

    const team = row.homeTeam === teamName ? "home" : "away";
    return [evaluateGame({ spreadHome: row.spreadHome, total: row.total, homeScore, awayScore }, team)];
  });

  return summarizeTrend(results);
}
