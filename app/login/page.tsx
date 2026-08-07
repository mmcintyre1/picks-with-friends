import { prisma } from "@/lib/prisma";

import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const members = await prisma.user.findMany({
    select: { username: true, name: true, pinHash: true },
    orderBy: { username: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-accent">Picks with Friends</h1>
        <p className="mt-1 text-sm text-muted">Who&apos;s picking?</p>
      </div>
      <LoginForm
        members={members.map((m) => ({
          username: m.username,
          name: m.name,
          claimed: m.pinHash !== null,
        }))}
      />
    </main>
  );
}
