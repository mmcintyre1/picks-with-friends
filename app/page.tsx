import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Hey {session.user.name ?? session.user.email}
        </h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm text-gray-500 underline">
            Sign out
          </button>
        </form>
      </div>
      <p className="text-sm text-gray-500">
        No parlays yet — the create-parlay flow lands in Phase 1.
      </p>
    </main>
  );
}
