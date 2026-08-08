import { prisma } from "@/lib/prisma";

import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const members = await prisma.user.findMany({
    select: { username: true, name: true, flair: true, pinHash: true },
    orderBy: { username: "asc" },
  });

  return (
    <main className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-accent">Picks with Friends</h1>
        <p className="mt-1 text-sm text-muted">Who&apos;s picking?</p>
      </div>
      <LoginForm
        members={members.map((m) => ({
          username: m.username,
          name: m.name,
          flair: m.flair,
          claimed: m.pinHash !== null,
        }))}
      />
    </main>
  );
}
