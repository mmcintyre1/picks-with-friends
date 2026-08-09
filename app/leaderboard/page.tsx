import Link from "next/link";

import { Badge, LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";
import { computeCurrentStreak, computeLongestStreak, computeProfit, effectiveCombinedOdds } from "@/lib/grading/parlayStats";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { MobileStatsCard } from "./MobileStatsCard";
import { StreakPill } from "./streakPill";

type Stats = {
  name: string;
  flair: string | null;
  moneybag: number;
  poo: number;
  toilet: number;
  cross: number;
  wins: number;
  losses: number;
  pushes: number;
  // Chronological, pushes excluded -- a push is neither a win nor a loss, so it
  // shouldn't break or extend a streak. Feeds computeCurrentStreak at render time.
  resultsInOrder: LegResult[];
};

export default async function LeaderboardPage() {
  const { group } = await requireUserAndGroup();

  // Parlay-level record: the group's collective parlay (not per-person), oldest first
  // so the dot strip reads left-to-right chronologically and streaks/order line up.
  const parlays = await prisma.parlay.findMany({
    where: { groupId: group.id, status: ParlayStatus.RESOLVED, countsForRecord: true },
    include: { window: true, legs: true },
    orderBy: { resolvedAt: "asc" },
  });

  const parlayRows = parlays.map((parlay) => {
    const combinedOdds = effectiveCombinedOdds(
      parlay.legs.map((leg) => ({ priceAtPick: leg.priceAtPick, result: leg.result })),
      parlay.oddsOverride,
    );
    const amount =
      parlay.result === LegResult.WIN
        ? combinedOdds !== null
          ? computeProfit(parlay.stake, combinedOdds)
          : null
        : -parlay.stake;
    return { parlay, amount };
  });

  const totalWins = parlayRows.filter((r) => r.parlay.result === LegResult.WIN).length;
  const totalLosses = parlayRows.filter((r) => r.parlay.result === LegResult.LOSS).length;
  const totalWinnings = parlayRows
    .filter((r) => r.parlay.result === LegResult.WIN && r.amount !== null)
    .reduce((sum, r) => sum + r.amount!, 0);
  const totalStaked = parlayRows.reduce((sum, r) => sum + r.parlay.stake, 0);
  const streak = computeCurrentStreak(parlayRows.map((r) => r.parlay.result));

  // On-the-fly aggregation, no materialized table -- fine at 4-user scale. Excludes
  // parlays marked as not counting toward the record. Ordered by when each leg's parlay
  // resolved, oldest first, so each user's own results land in chronological order for
  // streak purposes (same reasoning as parlayRows' ordering above).
  const legs = await prisma.leg.findMany({
    where: { parlay: { groupId: group.id, status: ParlayStatus.RESOLVED, countsForRecord: true } },
    include: { user: true },
    orderBy: { parlay: { resolvedAt: "asc" } },
  });

  const statsByUser = new Map<string, Stats>();
  for (const leg of legs) {
    const entry = statsByUser.get(leg.userId) ?? {
      name: leg.user.name ?? leg.user.username,
      flair: leg.user.flair,
      moneybag: 0,
      poo: 0,
      toilet: 0,
      cross: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      resultsInOrder: [],
    };
    if (leg.badge === Badge.MONEYBAG) entry.moneybag++;
    if (leg.badge === Badge.POO) entry.poo++;
    if (leg.badge === Badge.TOILET) entry.toilet++;
    if (leg.badge === Badge.CROSS) entry.cross++;
    if (leg.result === LegResult.WIN) entry.wins++;
    if (leg.result === LegResult.LOSS) entry.losses++;
    if (leg.result === LegResult.PUSH) entry.pushes++;
    if (leg.result !== LegResult.PUSH) entry.resultsInOrder.push(leg.result);
    statsByUser.set(leg.userId, entry);
  }

  // Winnings are a group-level number only (see the "Total winnings" tile above) -- not
  // broken out per person here, so nobody's individual results get singled out as a
  // personal dollar loss. Sort by net record instead.
  const rows = Array.from(statsByUser.values())
    .map((entry) => {
      // Last 10 decided results (pushes already excluded from resultsInOrder), same
      // "L10" convention as a baseball standings page -- shows fewer than 10 if a
      // player hasn't got a 10th game yet.
      const last10Results = entry.resultsInOrder.slice(-10);
      const last10Wins = last10Results.filter((r) => r === LegResult.WIN).length;
      return {
        ...entry,
        streak: computeCurrentStreak(entry.resultsInOrder),
        // Best-ever win streak / worst-ever losing streak, independent of where in their
        // history it happened -- not the same as the current (trailing) streak above.
        bestStreak: computeLongestStreak(entry.resultsInOrder, LegResult.WIN),
        worstStreak: computeLongestStreak(entry.resultsInOrder, LegResult.LOSS),
        last10: { wins: last10Wins, losses: last10Results.length - last10Wins },
      };
    })
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-3xl tracking-wide">All-time leaderboard</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Parlay record</h2>
        {parlayRows.length === 0 ? (
          <p className="text-sm text-muted">No parlays on the board yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3">
                <p className="text-xs text-muted">Record</p>
                <p className="font-display text-2xl tracking-wide tabular-nums">
                  {totalWins}-{totalLosses}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted">Streak</p>
                <p className="font-display text-2xl tracking-wide tabular-nums">
                  {streak ? `${streak.count} ${streak.result === LegResult.WIN ? "W" : "L"}` : "—"}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted">Total winnings</p>
                <p className={`font-display text-2xl tracking-wide tabular-nums ${totalWinnings >= 0 ? "text-win" : "text-loss"}`}>
                  {totalWinnings >= 0 ? "+" : "-"}${Math.abs(totalWinnings).toFixed(2)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted">Money in</p>
                <p className="font-display text-2xl tracking-wide tabular-nums">${totalStaked.toFixed(2)}</p>
              </Card>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parlayRows.map(({ parlay, amount }) => {
                const isWin = parlay.result === LegResult.WIN;
                const amountLabel = amount !== null ? `${amount >= 0 ? "+" : "-"}$${Math.abs(amount).toFixed(2)}` : "N/A";
                return (
                  <Link
                    key={parlay.id}
                    href={`/parlays/${parlay.id}`}
                    title={`${parlay.window.label ?? parlay.window.league} — ${amountLabel}`}
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold hover:opacity-80 ${
                      isWin ? "bg-win text-win-foreground" : "bg-loss text-loss-foreground"
                    }`}
                  >
                    {isWin ? "✓" : "✕"}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Individual stats</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nobody&apos;s got a track record yet.</p>
        ) : (
          <>
            {/* Mobile: stacked, collapsible cards -- a 10-column table has no room to
                breathe on a phone width, and showing every stat at once read as noisy
                clutter. Each card leads with the "at a glance" number (record + current
                streak) and reveals the rest (pushes/L10/bonus/best-worst) on tap. */}
            <div className="flex flex-col gap-2 sm:hidden">
              {rows.map((row) => (
                <MobileStatsCard key={row.name} row={row} />
              ))}
            </div>

            <Card className="hidden overflow-x-auto p-0 sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="pt-2 pr-4 pl-3" />
                  <th
                    colSpan={4}
                    className="pt-2 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-subtle"
                  >
                    Record
                  </th>
                  <th
                    colSpan={2}
                    className="border-l border-border pt-2 pb-1 pl-3 text-center text-[10px] font-medium uppercase tracking-wide text-subtle"
                  >
                    Bonus
                  </th>
                  <th
                    colSpan={3}
                    className="border-l border-border pt-2 pb-1 pl-3 text-center text-[10px] font-medium uppercase tracking-wide text-subtle"
                  >
                    Streaks
                  </th>
                </tr>
                <tr className="border-b border-border text-muted">
                  <th className="pb-2 pr-4 pl-3 text-left">Name</th>
                  <th className="pb-2 pr-3 text-center" title="Money bag — clean wins">
                    💰
                  </th>
                  <th className="pb-2 pr-3 text-center" title="Poo — losses">
                    💩
                  </th>
                  <th className="pb-2 pr-3 text-center" title="Push — tied, stake back for free">
                    🆓
                  </th>
                  <th className="pb-2 pr-3 text-right" title="Record over the last 10 decided legs">
                    L10
                  </th>
                  <th
                    className="border-l border-border pb-2 pr-3 pl-3 text-center"
                    title="Trash can — the lone loss in an otherwise-winning parlay"
                  >
                    🗑️
                  </th>
                  <th className="pb-2 pr-3 text-center" title="Cross — the lone win in an otherwise-losing parlay">
                    ✝️
                  </th>
                  <th className="w-20 border-l border-border pb-2 pr-3 text-right" title="Current streak">
                    Current
                  </th>
                  <th className="w-20 pb-2 pr-3 text-right" title="Best-ever win streak">
                    Best
                  </th>
                  <th className="w-20 pb-2 pr-3 text-right" title="Worst-ever losing streak">
                    Worst
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.name} className={i % 2 === 1 ? "bg-white/[0.02]" : undefined}>
                    <td className="py-2 pr-4 pl-3 font-medium">
                      <PlayerName name={row.name} flair={row.flair} />
                    </td>
                    <td className="py-2 pr-3 text-center text-win tabular-nums">{row.moneybag}</td>
                    <td className="py-2 pr-3 text-center text-loss tabular-nums">{row.poo}</td>
                    <td className="py-2 pr-3 text-center text-push tabular-nums">{row.pushes}</td>
                    <td className="py-2 pr-3 text-right text-muted tabular-nums">
                      {row.last10.wins}-{row.last10.losses}
                    </td>
                    <td className="border-l border-border py-2 pr-3 pl-3 text-center text-loss tabular-nums">
                      {row.toilet}
                    </td>
                    <td className="py-2 pr-3 text-center text-win tabular-nums">{row.cross}</td>
                    <td className="w-20 border-l border-border py-2 pr-3 text-right">
                      {row.streak ? (
                        <StreakPill count={row.streak.count} isWin={row.streak.result === LegResult.WIN} />
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="w-20 py-2 pr-3 text-right">
                      {row.bestStreak > 0 ? (
                        <StreakPill count={row.bestStreak} isWin={true} />
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="w-20 py-2 pr-3 text-right">
                      {row.worstStreak > 0 ? (
                        <StreakPill count={row.worstStreak} isWin={false} />
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </Card>
          </>
        )}
      </section>
    </main>
  );
}
