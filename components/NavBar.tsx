import { auth, signOut } from "@/auth";

import { NavLinks } from "./NavLinks";

export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="border-b border-border bg-card/60 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between text-sm">
        <NavLinks />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-muted underline hover:text-foreground">
            Sign out ({session.user.name ?? session.user.username})
          </button>
        </form>
      </div>
    </header>
  );
}
