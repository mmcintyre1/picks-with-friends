import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { AdminMemberRow } from "./AdminMemberRow";

export default async function AdminPage() {
  const { group } = await requireUserAndGroup();

  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true },
    orderBy: { user: { username: "asc" } },
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
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
    </main>
  );
}
