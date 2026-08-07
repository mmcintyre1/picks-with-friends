import { Badge, LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
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

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">All-time leaderboard</h1>
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
    </main>
  );
}
