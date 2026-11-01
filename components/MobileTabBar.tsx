"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { MenuIcon, PlusCircleIcon, SearchIcon, TicketIcon, TrophyIcon } from "@/components/ui/icons";

const TABS = [
  { href: "/", label: "Parlays", icon: TicketIcon, match: (p: string) => p === "/" || (p.startsWith("/parlays/") && p !== "/parlays/new") },
  { href: "/parlays/new", label: "New", icon: PlusCircleIcon, match: (p: string) => p === "/parlays/new" },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon, match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/research", label: "Research", icon: SearchIcon, match: (p: string) => p.startsWith("/research") },
];

const MORE_LINKS = [
  { href: "/admin", label: "Players" },
  { href: "/apis", label: "APIs" },
];

const tabClass = (active: boolean) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`;

// Phone navigation: a fixed bottom tab bar in thumb reach (like a sportsbook app) instead of
// a cramped row of small text links at the top -- where "Sign out" sat right under the
// links people tap most. Sign out now lives inside "More", away from everyday targets.
export function MobileTabBar({ userName, signOutAction }: { userName: string; signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_LINKS.some((l) => pathname.startsWith(l.href));

  // Navigating closes the sheet.
  useEffect(() => {
    setMoreOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] mx-3 mb-2 flex flex-col overflow-hidden rounded-xl border border-border-strong bg-card shadow-xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {MORE_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="border-b border-border px-4 py-4 text-base hover:bg-white/[0.04]">
                {link.label}
              </Link>
            ))}
            <form action={signOutAction}>
              <button type="submit" className="w-full px-4 py-4 text-left text-base text-loss hover:bg-white/[0.04]">
                Sign out <span className="text-sm text-subtle">({userName})</span>
              </button>
            </form>
          </div>
        </div>
      )}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname) && !moreOpen;
          return (
            <Link key={href} href={href} className={tabClass(active)} aria-current={active ? "page" : undefined}>
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen((o) => !o)} className={tabClass(moreOpen || moreActive)} aria-expanded={moreOpen}>
          <MenuIcon className="h-6 w-6" />
          More
        </button>
      </nav>
    </>
  );
}
