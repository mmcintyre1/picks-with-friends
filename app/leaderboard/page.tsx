import Link from "next/link";

import { Badge, LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { computeCombinedOdds, computeCurrentStreak, computeProfit } from "@/lib/grading/parlayStats";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

type Stats = {
  name: string;
  moneybag: number;
  poo: number;
  toilet: number;
  cross: number;
  wins: number;
  losses: number;
  pushes: number;
};

export default async function LeaderboardPage() {
  const { group } = await requireUserAndGroup();

  // On-the-fly aggregation, no materialized table -- fine at 4-user scale.
  // Excludes parlays marked as not counting toward the record.
  const legs = await prisma.leg.findMany({
    where: { parlay: { groupId: group.id, status: ParlayStatus.RESOLVED, countsForRecord: true } },
    include: { user: true },
  });

  const statsByUser = new Map<string, Stats>();
  for (const leg of legs) {
    const entry = statsByUser.get(leg.userId) ?? {
      name: leg.user.name ?? leg.user.username,
      moneybag: 0,
      poo: 0,
      toilet: 0,
      cross: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
    };
    if (leg.badge === Badge.MONEYBAG) entry.moneybag++;
    if (leg.badge === Badge.POO) entry.poo++;
    if (leg.badge === Badge.TOILET) entry.toilet++;
    if (leg.badge === Badge.CROSS) entry.cross++;
    if (leg.result === LegResult.WIN) entry.wins++;
    if (leg.result === LegResult.LOSS) entry.losses++;
    if (leg.result === LegResult.PUSH) entry.pushes++;
    statsByUser.set(leg.userId, entry);
  }

  const rows = Array.from(statsByUser.values()).sort((a, b) => b.wins - b.losses - (a.wins - a.losses));

  // Parlay-level record: the group's collective parlay (not per-person), oldest first
  // so the dot strip reads left-to-right chronologically and streaks/order line up.
  const parlays = await prisma.parlay.findMany({
    where: { groupId: group.id, status: ParlayStatus.RESOLVED, countsForRecord: true },
    include: { window: true, legs: true },
    orderBy: { resolvedAt: "asc" },
  });

  const parlayRows = parlays.map((parlay) => {
    const combinedOdds = computeCombinedOdds(
      parlay.legs.map((leg) => ({ priceAtPick: leg.priceAtPick, result: leg.result })),
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
  const streak = computeCurrentStreak(parlayRows.map((r) => r.parlay.result));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <h1 className="text-2xl font-semibold">All-time leaderboard</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Parlay record</h2>
        {parlayRows.length === 0 ? (
          <p className="text-sm text-gray-500">No resolved parlays yet.</p>
        ) : (
          <>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-500">Record</p>
                <p className="text-lg font-semibold">
                  {totalWins}-{totalLosses}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Streak</p>
                <p className="text-lg font-semibold">
                  {streak
                    ? `${streak.count} ${streak.result === LegResult.WIN ? "W" : "L"}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total winnings</p>
                <p
                  className={`text-lg font-semibold ${totalWinnings >= 0 ? "text-green-600" : "text-red-500"}`}
                >
                  {totalWinnings >= 0 ? "+" : "-"}${Math.abs(totalWinnings).toFixed(2)}
                </p>
              </div>
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
                    className={`h-4 w-4 rounded-full ${isWin ? "bg-green-500" : "bg-red-500"} hover:opacity-75`}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Individual stats</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No resolved parlays yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-800">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">W-L-P</th>
                  <th className="py-2 pr-4">💰</th>
                  <th className="py-2 pr-4">💩</th>
                  <th className="py-2 pr-4">🚽</th>
                  <th className="py-2 pr-4">✝️</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-b border-gray-100 dark:border-gray-900">
                    <td className="py-2 pr-4 font-medium">{row.name}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      {row.wins}-{row.losses}-{row.pushes}
                    </td>
                    <td className="py-2 pr-4">{row.moneybag}</td>
                    <td className="py-2 pr-4">{row.poo}</td>
                    <td className="py-2 pr-4">{row.toilet}</td>
                    <td className="py-2 pr-4">{row.cross}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
