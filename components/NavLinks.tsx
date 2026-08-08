"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/parlays/new", label: "New parlay" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin", label: "Players" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 sm:gap-5">
      <Link
        href="/"
        className={`font-display text-lg tracking-wide ${pathname === "/" ? "text-accent" : "text-foreground"}`}
      >
        <span className="hidden sm:inline">Picks with Friends</span>
        <span className="sm:hidden">🎟️ Picks</span>
      </Link>
      {NAV_LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`font-display text-xs tracking-wide sm:text-sm ${
              active ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
