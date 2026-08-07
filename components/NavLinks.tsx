"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/parlays/new", label: "New parlay" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-5">
      <Link
        href="/"
        className={`font-display text-lg tracking-wide ${pathname === "/" ? "text-accent" : "text-foreground"}`}
      >
        Picks with Friends
      </Link>
      {NAV_LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`font-display text-sm tracking-wide ${active ? "text-accent" : "text-muted hover:text-foreground"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
