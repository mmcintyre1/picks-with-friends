"use client";

import { Side } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { teamLogoUrl } from "@/lib/rosters/leagues";
import { bookLabel, mapGameLinesSelectionToPick } from "@/lib/sharpapi/categorize";
import type { ResearchCategory, ResearchSelection, TeamBetPick } from "@/lib/sharpapi/types";

import { TeamLabel } from "./TeamMarketGrid";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// Each selection's own `line` is already signed correctly for that side (a real captured
// away-team spread row came back as a positive value for an underdog getting points) --
// this just adds the "+" JS omits for positive numbers, it doesn't infer a sign.
function formatSignedLine(line: number | null): string {
  if (line === null) return "";
  return line > 0 ? `+${line}` : `${line}`;
}

// The book is secondary context to the line/price -- a small corner tag rather than its own
// line, so it doesn't compete with the numbers that actually matter for space in this
// already-compact grid.
const cellClass =
  "relative flex flex-col items-center gap-0.5 truncate rounded-lg border border-border bg-card px-1.5 pt-3 pb-2 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10";
const bookTagClass = "absolute right-1 top-0.5 text-[7px] leading-none text-subtle";
const columnHeaderClass = "truncate text-center text-[10px] font-medium uppercase tracking-wide text-subtle";
const emptyCellClass = "flex items-center justify-center rounded-lg border border-border/50 px-1.5 py-2 text-xs text-subtle";

// Hoisted to module scope (not declared inside ResearchNumberedGrid) so it isn't recreated
// every render -- takes onSelect as a prop instead of closing over the parent's handler.
function TeamCell({
  selection,
  label,
  onSelect,
}: {
  selection: ResearchSelection | undefined;
  label: string;
  onSelect: (selection: ResearchSelection) => void;
}) {
  if (!selection) return <div className={emptyCellClass}>—</div>;
  return (
    <button type="button" className={cellClass} onClick={() => onSelect(selection)}>
      <span className={bookTagClass}>{bookLabel(selection.sportsbook)}</span>
      <span>{label}</span>
      <span className="font-display tracking-wide text-accent tabular-nums">{formatPrice(selection.priceAmerican)}</span>
    </button>
  );
}

// Sibling to TeamMarketGrid.tsx, not a parameterized reuse of it -- same row-per-team,
// column-per-market visual language, but tap-and-immediately-select (this data has real
// prices, unlike TeamMarketGrid's numberless manual-entry grid), so the two components'
// clicks do fundamentally different things.
export function ResearchNumberedGrid({
  league,
  homeTeam,
  awayTeam,
  externalId,
  category,
  segment = null,
  onSelectTeamBet,
}: {
  league: string;
  homeTeam: string;
  awayTeam: string;
  externalId: string;
  category: ResearchCategory;
  // Which market-group segment to render -- null (default) for full-game Game Lines, or
  // e.g. "1st_half" to render that segment's own tab (see ResearchGameDetail).
  segment?: string | null;
  onSelectTeamBet: (pick: TeamBetPick) => void;
}) {
  const game = { homeTeam, awayTeam, externalId };

  const fullGameGroup = (marketType: string) =>
    category.marketGroups.find((g) => g.marketType === marketType && g.segment === segment);

  const spread = fullGameGroup("point_spread");
  const total = fullGameGroup("total_points");
  const moneyline = fullGameGroup("moneyline");

  // A market can carry several rows for the same side (alternate lines, confirmed real --
  // a single game had 406 total rows for markets with only ~30 truly distinct selections).
  // The compact grid only ever shows the primary one; prefer isMainLine, but fall back to
  // any match if nothing was flagged main (older/incomplete data) so a cell never goes
  // empty just because the main-line flag is missing.
  const findSelection = (group: typeof spread, side: Side) =>
    group?.selections.find((s) => s.side === side && s.isMainLine) ?? group?.selections.find((s) => s.side === side);

  function select(marketType: string, selection: ResearchSelection | undefined) {
    if (!selection) return;
    const pick = mapGameLinesSelectionToPick(game, marketType, selection);
    if (pick) onSelectTeamBet(pick);
  }

  const awayMoneyline = findSelection(moneyline, Side.AWAY);
  const homeMoneyline = findSelection(moneyline, Side.HOME);
  const awaySpread = findSelection(spread, Side.AWAY);
  const homeSpread = findSelection(spread, Side.HOME);
  const over = findSelection(total, Side.OVER);
  const under = findSelection(total, Side.UNDER);

  return (
    <Card className="grid w-full min-w-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-x-1.5 gap-y-2 overflow-hidden p-2">
      <span />
      <span className={columnHeaderClass}>Spread</span>
      <span className={columnHeaderClass}>Total</span>
      <span className={columnHeaderClass}>Moneyline</span>

      <span className="flex min-w-0 items-center">
        <TeamLabel name={awayTeam} logo={teamLogoUrl(league, awayTeam)} league={league} />
      </span>
      <TeamCell
        selection={awaySpread}
        label={formatSignedLine(awaySpread?.line ?? null)}
        onSelect={(s) => select("point_spread", s)}
      />
      <div className="row-span-2 flex min-w-0 flex-col gap-1">
        <button
          type="button"
          className={`flex-1 ${over ? cellClass : emptyCellClass}`}
          onClick={() => select("total_points", over)}
          disabled={!over}
        >
          {over ? (
            <>
              <span className={bookTagClass}>{bookLabel(over.sportsbook)}</span>
              <span>O {over.line}</span>
              <span className="font-display tracking-wide text-accent tabular-nums">{formatPrice(over.priceAmerican)}</span>
            </>
          ) : (
            "—"
          )}
        </button>
        <button
          type="button"
          className={`flex-1 ${under ? cellClass : emptyCellClass}`}
          onClick={() => select("total_points", under)}
          disabled={!under}
        >
          {under ? (
            <>
              <span className={bookTagClass}>{bookLabel(under.sportsbook)}</span>
              <span>U {under.line}</span>
              <span className="font-display tracking-wide text-accent tabular-nums">{formatPrice(under.priceAmerican)}</span>
            </>
          ) : (
            "—"
          )}
        </button>
      </div>
      <TeamCell selection={awayMoneyline} label="ML" onSelect={(s) => select("moneyline", s)} />

      <span className="flex min-w-0 items-center">
        <TeamLabel name={homeTeam} logo={teamLogoUrl(league, homeTeam)} league={league} />
      </span>
      <TeamCell
        selection={homeSpread}
        label={formatSignedLine(homeSpread?.line ?? null)}
        onSelect={(s) => select("point_spread", s)}
      />
      <TeamCell selection={homeMoneyline} label="ML" onSelect={(s) => select("moneyline", s)} />
    </Card>
  );
}
