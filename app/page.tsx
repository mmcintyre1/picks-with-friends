import Link from "next/link";
import type { ReactNode } from "react";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
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
        <h1 className="font-display text-3xl tracking-wide">Hey {user.name ?? user.username}</h1>
        <Link href="/parlays/new" className={buttonClassName()}>
          New parlay
        </Link>
      </div>

      <ParlaySection
        title="Needs your pick"
        parlays={needsYourPick}
        emptyText="Nothing waiting on you."
        badge={() => <StatusPill tone="accent">Your move</StatusPill>}
      />
      <ParlaySection
        title="Open, waiting on others"
        parlays={openWaiting}
        emptyText="Nothing here."
        badge={() => <StatusPill tone="muted">Waiting</StatusPill>}
      />
      <ParlaySection
        title="Locked, awaiting grading"
        parlays={locked}
        emptyText="Nothing here."
        badge={() => <StatusPill tone="pending">Grading</StatusPill>}
      />
      <ParlaySection
        title="Recently resolved"
        parlays={resolved}
        emptyText="No results yet."
        badge={(p) =>
          p.result === LegResult.WIN ? (
            <StatusPill tone="win">Won</StatusPill>
          ) : (
            <StatusPill tone="loss">Lost</StatusPill>
          )
        }
      />
    </main>
  );
}

type ParlayRow = {
  id: string;
  countsForRecord: boolean;
  createdAt: Date;
  result: LegResult;
  window: { league: string; label: string | null };
  legs: { priceAtPick: number | null; result: LegResult }[];
};

function ParlaySection({
  title,
  parlays,
  emptyText,
  badge,
}: {
  title: string;
  parlays: ParlayRow[];
  emptyText: string;
  badge: (parlay: ParlayRow) => ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      {parlays.length === 0 ? (
        <p className="text-sm text-subtle">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {parlays.map((parlay) => {
            const combinedOdds = computeCombinedOdds(parlay.legs);
            return (
              <Link key={parlay.id} href={`/parlays/${parlay.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm transition-colors hover:border-border-strong">
                  <span className="flex min-w-0 items-center gap-2">
                    {badge(parlay)}
                    <span className="truncate">{parlay.window.label ?? parlay.window.league}</span>
                    {!parlay.countsForRecord && <span className="shrink-0 text-subtle"> (fun)</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-muted">
                    {parlay.legs.length > 0 && (
                      <span className="font-display text-base tracking-wide text-accent tabular-nums">
                        {combinedOdds !== null ? formatAmericanOdds(decimalToAmerican(combinedOdds)) : "N/A"}
                      </span>
                    )}
                    {parlay.createdAt.toLocaleDateString()}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
