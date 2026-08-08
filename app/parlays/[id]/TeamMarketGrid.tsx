"use client";

import Image from "next/image";

import { Market, Side } from "@/app/generated/prisma/enums";
import { teamAbbreviation } from "@/lib/rosters/leagues";

const cellClass = (active: boolean) =>
  `truncate rounded-lg border px-1.5 py-2 text-xs font-medium transition-colors ${
    active
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border bg-card text-muted hover:border-border-strong hover:text-foreground"
  }`;

const columnHeaderClass = "truncate text-center text-[10px] font-medium uppercase tracking-wide text-subtle";

// Full name on desktop (more room), abbreviation on mobile -- this row label is the one
// place team identity shows up once you're past the schedule/matchup step, so it needs to
// stay compact without going back to a blind CSS ellipsis mid-name. Exported for reuse in
// PickLegForm's read-only matchup display (player-prop mode, once a game's resolved).
export function TeamLabel({ name, logo, league }: { name: string; logo: string | null; league: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
      {logo ? (
        <Image src={logo} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 object-contain" />
      ) : (
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/5 text-[9px] font-semibold text-subtle">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
      <span className="truncate sm:hidden">{teamAbbreviation(league, name) || "—"}</span>
      <span className="hidden truncate sm:inline">{name.trim() || "—"}</span>
    </span>
  );
}

// A DraftKings-style board: one row per team, one column per market. No prices in cells
// (this app has no live-odds source for most sports, see lib/odds/'s Research-tab-only
// scope) -- clicking a cell just sets market+side, same as the select pair this replaced.
// Total isn't team-specific (there's no "away team's total"), so its column is a single
// cell spanning both team rows (row-span-2) rather than a separate Over/Under pair
// repeated identically in each row -- same column, just not duplicated.
export function TeamMarketGrid({
  league,
  awayTeam,
  homeTeam,
  awayLogo,
  homeLogo,
  market,
  side,
  onSelect,
}: {
  league: string;
  awayTeam: string;
  homeTeam: string;
  awayLogo: string | null;
  homeLogo: string | null;
  market: Market;
  side: Side;
  onSelect: (market: Market, side: Side) => void;
}) {
  const isSelected = (m: Market, s: Side) => market === m && side === s;

  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-x-1.5 gap-y-2 overflow-hidden rounded-lg border border-border bg-card p-2">
      <span />
      <span className={columnHeaderClass}>Spread</span>
      <span className={columnHeaderClass}>Total</span>
      <span className={columnHeaderClass}>Moneyline</span>

      <span className="flex min-w-0 items-center">
        <TeamLabel name={awayTeam} logo={awayLogo} league={league} />
      </span>
      <button
        type="button"
        className={cellClass(isSelected(Market.SPREAD, Side.AWAY))}
        onClick={() => onSelect(Market.SPREAD, Side.AWAY)}
      >
        Spread
      </button>
      <div className="row-span-2 flex min-w-0 flex-col gap-1">
        <button
          type="button"
          className={`flex-1 ${cellClass(isSelected(Market.TOTAL, Side.OVER))}`}
          onClick={() => onSelect(Market.TOTAL, Side.OVER)}
        >
          Over
        </button>
        <button
          type="button"
          className={`flex-1 ${cellClass(isSelected(Market.TOTAL, Side.UNDER))}`}
          onClick={() => onSelect(Market.TOTAL, Side.UNDER)}
        >
          Under
        </button>
      </div>
      <button
        type="button"
        className={cellClass(isSelected(Market.MONEYLINE, Side.AWAY))}
        onClick={() => onSelect(Market.MONEYLINE, Side.AWAY)}
      >
        ML
      </button>

      <span className="flex min-w-0 items-center">
        <TeamLabel name={homeTeam} logo={homeLogo} league={league} />
      </span>
      <button
        type="button"
        className={cellClass(isSelected(Market.SPREAD, Side.HOME))}
        onClick={() => onSelect(Market.SPREAD, Side.HOME)}
      >
        Spread
      </button>
      <button
        type="button"
        className={cellClass(isSelected(Market.MONEYLINE, Side.HOME))}
        onClick={() => onSelect(Market.MONEYLINE, Side.HOME)}
      >
        ML
      </button>
    </div>
  );
}
