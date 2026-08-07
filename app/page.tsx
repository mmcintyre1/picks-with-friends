import Link from "next/link";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { computeCombinedOdds, decimalToAmerican, formatAmericanOdds } from "@/lib/grading/parlayStats";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

export default async function DashboardPage() {
  const { user, group } = await requireUserAndGroup();

  const parlays = await prisma.parlay.findMany({
    where: { groupId: group.id },
    include: { window: true, legs: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const needsYourPick = parlays.filter(
    (p) => p.status === ParlayStatus.OPEN && !p.legs.some((l) => l.userId === user.id),
  );
  const openWaiting = parlays.filter(
    (p) => p.status === ParlayStatus.OPEN && p.legs.some((l) => l.userId === user.id),
  );
  const locked = parlays.filter((p) => p.status === ParlayStatus.LOCKED);
  const resolved = parlays.filter((p) => p.status === ParlayStatus.RESOLVED);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hey {user.name ?? user.username}</h1>
        <Link
          href="/parlays/new"
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          New parlay
        </Link>
      </div>

      <ParlaySection title="Needs your pick" parlays={needsYourPick} emptyText="Nothing waiting on you." />
      <ParlaySection title="Open, waiting on others" parlays={openWaiting} emptyText="Nothing here." />
      <ParlaySection title="Locked, awaiting grading" parlays={locked} emptyText="Nothing here." />
      <ParlaySection title="Recently resolved" parlays={resolved} emptyText="No results yet." />
    </main>
  );
}

type ParlayRow = {
  id: string;
  countsForRecord: boolean;
  createdAt: Date;
  window: { league: string; label: string | null };
  legs: { priceAtPick: number | null; result: LegResult }[];
};

function ParlaySection({
  title,
  parlays,
  emptyText,
}: {
  title: string;
  parlays: ParlayRow[];
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-gray-500">{title}</h2>
      {parlays.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {parlays.map((parlay) => {
            const combinedOdds = computeCombinedOdds(parlay.legs);
            return (
              <Link
                key={parlay.id}
                href={`/parlays/${parlay.id}`}
                className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              >
                <span>
                  {parlay.window.label ?? parlay.window.league}
                  {!parlay.countsForRecord && " (fun)"}
                </span>
                <span className="flex items-center gap-3 text-gray-500">
                  {parlay.legs.length > 0 && (
                    <span>{combinedOdds !== null ? formatAmericanOdds(decimalToAmerican(combinedOdds)) : "N/A"}</span>
                  )}
                  {parlay.createdAt.toLocaleDateString()}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
