import { Side } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { ResearchGame, ResearchMarketGroup } from "@/lib/research/types";

// Same main-line lookup ResearchNumberedGrid.tsx already uses to render a game's Spread/
// Total cells: prefer the selection flagged isMainLine, falling back to any match on that
// side if nothing was flagged (older/incomplete provider data) so a real line never gets
// missed just because the main-line flag wasn't set.
function findSelection(group: ResearchMarketGroup | undefined, side: Side) {
  return group?.selections.find((s) => s.side === side && s.isMainLine) ?? group?.selections.find((s) => s.side === side);
}

function extractMainLines(game: ResearchGame): { spreadHome: number | null; total: number | null } {
  const gameLines = game.categories.find((c) => c.key === "game_lines");
  const findGroup = (marketType: string) => gameLines?.marketGroups.find((g) => g.marketType === marketType && g.segment === null);

  const homeSpread = findSelection(findGroup("point_spread"), Side.HOME);
  const totalSelection = findSelection(findGroup("total_points"), Side.OVER) ?? findSelection(findGroup("total_points"), Side.UNDER);

  return { spreadHome: homeSpread?.line ?? null, total: totalSelection?.line ?? null };
}

// Snapshots a real game's own main spread/total the moment this app's research layer
// fetches its odds -- called fire-and-forget from lib/research/actions.ts's
// getNflGameOdds, so every real game-detail view (the existing pick flow AND the new
// /research page) feeds the free, app-owned trend database with zero new fetches of its
// own. Overwrites the tracked line on every call up until the game's own commenceTime
// passes, then freezes it -- the last real view before kickoff is a free stand-in for the
// true closing line, never exactly the same but the best available without paying a vendor
// for real historical odds. Never throws -- a snapshot failing to record should never fail
// the odds response it's riding along with; callers swallow whatever this rejects with.
export async function recordLineSnapshot(league: string, game: ResearchGame): Promise<void> {
  const commenceTime = new Date(game.commenceTime);
  const { spreadHome, total } = extractMainLines(game);

  const key = { league_homeTeam_awayTeam_commenceTime: { league, homeTeam: game.homeTeam, awayTeam: game.awayTeam, commenceTime } };
  const existing = await prisma.trackedGame.findUnique({ where: key });

  if (!existing) {
    if (spreadHome === null && total === null) return; // nothing real to record yet
    await prisma.trackedGame.create({ data: { league, homeTeam: game.homeTeam, awayTeam: game.awayTeam, commenceTime, spreadHome, total } });
    return;
  }

  if (commenceTime.getTime() <= Date.now()) return; // frozen once the game has started

  // Only touch fields this fetch actually has a real value for -- a transient partial read
  // (e.g. the total market missing from just this one response) must never wipe out a
  // previously recorded real spread/total with a null.
  const update: { spreadHome?: number; total?: number } = {};
  if (spreadHome !== null) update.spreadHome = spreadHome;
  if (total !== null) update.total = total;
  if (Object.keys(update).length === 0) return;

  await prisma.trackedGame.update({ where: key, data: update });
}
