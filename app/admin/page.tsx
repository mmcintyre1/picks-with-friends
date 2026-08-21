import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { AdminMemberRow } from "./AdminMemberRow";
import { AdminParlayRow } from "./AdminParlayRow";
import { WipeParlaysButton } from "./WipeParlaysButton";

export default async function AdminPage() {
  const { group } = await requireUserAndGroup();

  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true },
    orderBy: { user: { username: "asc" } },
  });

  const parlays = await prisma.parlay.findMany({
    where: { groupId: group.id },
    include: { window: true, legs: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Players</h1>
        <p className="text-sm text-muted">
          Rename, flair, or reset anyone&apos;s PIN. Everyone in the group can do this to everyone.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {members.map((m) => (
          <AdminMemberRow
            key={m.userId}
            userId={m.userId}
            username={m.user.username}
            name={m.user.name ?? m.user.username}
            flair={m.user.flair}
            claimed={m.user.pinHash !== null}
            locked={Boolean(m.user.lockedUntil && m.user.lockedUntil > new Date())}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl tracking-wide">Parlays</h2>
            <p className="text-sm text-muted">
              Delete any parlay -- open, locked, or resolved -- or wipe the whole board.
            </p>
          </div>
          <WipeParlaysButton count={parlays.length} />
        </div>

        {parlays.length === 0 ? (
          <p className="text-sm text-subtle">No parlays yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {parlays.map((parlay) => (
              <AdminParlayRow
                key={parlay.id}
                id={parlay.id}
                label={parlay.window.label ?? parlay.window.league}
                status={parlay.status}
                result={parlay.result}
                createdAt={parlay.createdAt}
                legCount={parlay.legs.length}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
