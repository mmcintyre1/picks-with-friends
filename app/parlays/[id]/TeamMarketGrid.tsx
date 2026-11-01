"use client";

import Image from "next/image";

import { teamAbbreviation } from "@/lib/rosters/leagues";

// The circular logo-or-initial avatar on its own, no name text -- extracted out of
// TeamLabel below so a context that wants just the icon (e.g. next to a player's own name
// in a prop row, where the *team* name isn't shown at all) doesn't have to duplicate this
// fallback markup a second time.
export function TeamAvatar({
  logo,
  name,
  size = "h-[18px] w-[18px]",
}: {
  logo: string | null;
  name: string;
  size?: string;
}) {
  if (logo) {
    return <Image src={logo} alt="" width={18} height={18} className={`${size} shrink-0 object-contain`} />;
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-white/5 text-[9px] font-semibold text-subtle ${size}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// Full name on desktop (more room), abbreviation on mobile -- this row label is the one
// place team identity shows up once you're past the schedule/matchup step, so it needs to
// stay compact without going back to a blind CSS ellipsis mid-name. Exported for reuse in
// PickLegForm's read-only matchup display and LegRow's game line -- `size`/`textClassName`
// let each caller fit its own context (the pick grid's row labels vs. a muted secondary
// line) without forking the component.
export function TeamLabel({
  name,
  logo,
  league,
  size = "h-[18px] w-[18px]",
  textClassName = "text-sm font-medium",
}: {
  name: string;
  logo: string | null;
  league: string;
  size?: string;
  textClassName?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${textClassName}`}>
      <TeamAvatar logo={logo} name={name} size={size} />
      <span className="truncate sm:hidden">{teamAbbreviation(league, name) || "—"}</span>
      <span className="hidden truncate sm:inline">{name.trim() || "—"}</span>
    </span>
  );
}
