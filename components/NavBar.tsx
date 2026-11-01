import { auth, signOut } from "@/auth";

import { MobileTabBar } from "./MobileTabBar";
import { NavLinks } from "./NavLinks";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;
  const userName = session.user.name ?? session.user.username ?? "";

  return (
    <>
      <header className="border-b border-border bg-card/60 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 text-sm">
          <NavLinks />
          {/* Phones sign out from the bottom bar's "More" sheet instead. */}
          <form action={signOutAction} className="hidden sm:block">
            <button type="submit" className="whitespace-nowrap text-sm text-muted underline hover:text-foreground">
              Sign out<span className="hidden lg:inline"> ({userName})</span>
            </button>
          </form>
        </div>
      </header>
      <MobileTabBar userName={userName} signOutAction={signOutAction} />
    </>
  );
}
