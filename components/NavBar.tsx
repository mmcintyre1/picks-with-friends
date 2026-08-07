import Link from "next/link";

import { auth, signOut } from "@/auth";

export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 text-sm dark:border-gray-800">
      <nav className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          Picks with Friends
        </Link>
        <Link href="/parlays/new" className="text-gray-500 hover:text-inherit">
          New parlay
        </Link>
        <Link href="/leaderboard" className="text-gray-500 hover:text-inherit">
          Leaderboard
        </Link>
      </nav>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="text-gray-500 underline">
          Sign out ({session.user.name ?? session.user.username})
        </button>
      </form>
    </header>
  );
}
