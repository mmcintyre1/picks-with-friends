"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/parlays/new", label: "New parlay" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research" },
  { href: "/admin", label: "Players" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 sm:gap-5">
      <Link
        href="/"
        className={`flex items-center gap-2 font-display text-lg tracking-wide ${
          pathname === "/" ? "text-accent" : "text-foreground"
        }`}
      >
        <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md" priority />
        <span className="hidden sm:inline">Picks with Friends</span>
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
