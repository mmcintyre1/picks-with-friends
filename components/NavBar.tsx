import { auth, signOut } from "@/auth";

import { NavLinks } from "./NavLinks";

export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="border-b border-border bg-card/60 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-y-1 text-sm">
        <NavLinks />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-xs text-muted underline hover:text-foreground sm:text-sm">
            <span className="hidden sm:inline">Sign out ({session.user.name ?? session.user.username})</span>
            <span className="sm:hidden">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
