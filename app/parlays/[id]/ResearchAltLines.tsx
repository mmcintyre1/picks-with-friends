"use client";

import { Side } from "@/app/generated/prisma/enums";
import { TierPager } from "@/components/ui/TierPager";
import { altLinesForMarket, bookLabel, mapGameLinesSelectionToPick } from "@/lib/sharpapi/categorize";
import type { ResearchCategory, TeamBetPick } from "@/lib/sharpapi/types";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

function formatSignedLine(line: number | null): string {
  if (line === null) return "";
  return line > 0 ? `+${line}` : `${line}`;
}

const tierButtonClass =
  "flex w-full flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10";

const SIDE_LABELS: Partial<Record<Side, string>> = {
  [Side.AWAY]: "Away",
  [Side.HOME]: "Home",
  [Side.OVER]: "Over",
  [Side.UNDER]: "Under",
};

// The compact ResearchNumberedGrid only ever shows the main line per side -- this lists
// every other posted line (confirmed real: alternate spreads/totals routinely exist
// alongside the main line, especially on segment markets) as its own tappable tier, the
// same way DraftKings' own "more lines" drill-down works. Only point_spread/total_points
// (not team_total -- see categorize.ts's comment on why that one's excluded) have a clean
// Market/Side mapping to pick from here.
export function ResearchAltLines({
  homeTeam,
  awayTeam,
  externalId,
  category,
  segment,
  onSelectTeamBet,
}: {
  homeTeam: string;
  awayTeam: string;
  externalId: string;
  category: ResearchCategory;
  segment: string | null;
  onSelectTeamBet: (pick: TeamBetPick) => void;
}) {
  const game = { homeTeam, awayTeam, externalId };
  const spreadGroups = altLinesForMarket(category, "point_spread", segment);
  const totalGroups = altLinesForMarket(category, "total_points", segment);

  if (spreadGroups.length === 0 && totalGroups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {spreadGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Alternate Spreads</p>
          {spreadGroups.map(({ side, selections }) => (
            <div key={side} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
              <span className="min-w-0 shrink-0 text-sm font-medium">{side === Side.AWAY ? awayTeam : homeTeam}</span>
              <div className="min-w-0 flex-1">
                <TierPager
                  items={selections}
                  keyFor={(s) => s.selectionId}
                  renderItem={(s) => (
                    <button
                      type="button"
                      className={tierButtonClass}
                      onClick={() => {
                        const pick = mapGameLinesSelectionToPick(game, "point_spread", s);
                        if (pick) onSelectTeamBet(pick);
                      }}
                    >
                      <span>{formatSignedLine(s.line)}</span>
                      <span className="font-display tracking-wide text-accent tabular-nums">{formatPrice(s.priceAmerican)}</span>
                      <span className="text-[9px] text-subtle">{bookLabel(s.sportsbook)}</span>
                    </button>
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {totalGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Alternate Totals</p>
          {totalGroups.map(({ side, selections }) => (
            <div key={side} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
              <span className="min-w-0 shrink-0 text-sm font-medium">{SIDE_LABELS[side]}</span>
              <div className="min-w-0 flex-1">
                <TierPager
                  items={selections}
                  keyFor={(s) => s.selectionId}
                  renderItem={(s) => (
                    <button
                      type="button"
                      className={tierButtonClass}
                      onClick={() => {
                        const pick = mapGameLinesSelectionToPick(game, "total_points", s);
                        if (pick) onSelectTeamBet(pick);
                      }}
                    >
                      <span>{s.line}</span>
                      <span className="font-display tracking-wide text-accent tabular-nums">{formatPrice(s.priceAmerican)}</span>
                      <span className="text-[9px] text-subtle">{bookLabel(s.sportsbook)}</span>
                    </button>
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
