import Link from "next/link";

import { Badge, LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";
import { computeCurrentStreak, computeProfit, effectiveCombinedOdds } from "@/lib/grading/parlayStats";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

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

// Pill styling stays fixed-shape across every tier so a streak cell never reflows --
// only color/weight scale with length ("hotness"), no icon that appears/disappears.
function streakPillClass(count: number, isWin: boolean): string {
  const base = "inline-block rounded px-1.5 py-0.5 font-display tracking-wide tabular-nums";
  if (isWin) {
    if (count >= 5) return `${base} bg-win font-bold text-win-foreground`;
    if (count >= 3) return `${base} bg-win/20 font-semibold text-win`;
    return `${base} text-win`;
  }
  if (count >= 5) return `${base} bg-loss font-bold text-loss-foreground`;
  if (count >= 3) return `${base} bg-loss/20 font-semibold text-loss`;
  return `${base} text-loss`;
}

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
    .map((entry) => ({
      ...entry,
      winRate: entry.wins + entry.losses > 0 ? entry.wins / (entry.wins + entry.losses) : null,
      streak: computeCurrentStreak(entry.resultsInOrder),
    }))
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
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="pt-2 pr-4 pl-3" />
                  <th className="pt-2 pr-4" />
                  <th className="pt-2 pr-4" />
                  <th className="pt-2 pr-3" />
                  <th className="pt-2 pr-3" />
                  <th className="pt-2 pr-3" />
                  <th colSpan={2} className="border-l border-border pt-2 pb-1 pl-3 text-center text-[10px] font-medium uppercase tracking-wide text-subtle">
                    Awards
                  </th>
                </tr>
                <tr className="border-b border-border text-muted">
                  <th className="pb-2 pr-4 pl-3 text-left">Name</th>
                  <th className="pb-2 pr-4 text-right">Record</th>
                  <th className="pb-2 pr-4 text-right">Streak</th>
                  <th className="pb-2 pr-3 text-center" title="Money bag — clean wins">
                    💰
                  </th>
                  <th className="pb-2 pr-3 text-center" title="Push — tied, stake back for free">
                    🆓
                  </th>
                  <th className="pb-2 pr-3 text-center" title="Poo — losses">
                    💩
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.name} className={i % 2 === 1 ? "bg-white/[0.02]" : undefined}>
                    <td className="py-2 pr-4 pl-3 font-medium">
                      <PlayerName name={row.name} flair={row.flair} />
                    </td>
                    <td className="py-2 pr-4 text-right text-muted tabular-nums">
                      {row.wins}-{row.losses}-{row.pushes}
                      {row.winRate !== null && (
                        <span className="text-subtle"> ({Math.round(row.winRate * 100)}%)</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {row.streak ? (
                        <span className={streakPillClass(row.streak.count, row.streak.result === LegResult.WIN)}>
                          {row.streak.count}
                          {row.streak.result === LegResult.WIN ? "W" : "L"}
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-center text-win tabular-nums">{row.moneybag}</td>
                    <td className="py-2 pr-3 text-center text-push tabular-nums">{row.pushes}</td>
                    <td className="py-2 pr-3 text-center text-loss tabular-nums">{row.poo}</td>
                    <td className="border-l border-border py-2 pr-3 pl-3 text-center text-loss tabular-nums">
                      {row.toilet}
                    </td>
                    <td className="py-2 pr-3 text-center text-win tabular-nums">{row.cross}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </main>
  );
}
