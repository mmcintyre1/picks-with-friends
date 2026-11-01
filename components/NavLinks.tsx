"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Parlays" },
  { href: "/parlays/new", label: "New parlay" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research" },
  { href: "/admin", label: "Players" },
  { href: "/apis", label: "APIs" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || (pathname.startsWith("/parlays/") && pathname !== "/parlays/new");
  return pathname.startsWith(href);
}

// Desktop top-bar links. On phones the links live in the bottom tab bar (MobileTabBar), so
// the top bar there is just the brand.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 lg:gap-5">
      <Link href="/" className="flex items-center gap-2 font-display text-lg tracking-wide text-foreground">
        <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md" priority />
        {/* Phones show the name (no links up here); mid-width desktops drop it so the links fit on one line. */}
        <span className="whitespace-nowrap sm:hidden lg:inline">Picks with Friends</span>
      </Link>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`hidden whitespace-nowrap font-display text-sm tracking-wide sm:inline ${
            isActive(link.href, pathname) ? "text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
