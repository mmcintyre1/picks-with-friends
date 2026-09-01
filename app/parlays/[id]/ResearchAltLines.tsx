"use client";

import { Side, TeamSide } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { TierPager } from "@/components/ui/TierPager";
import { altLinesForMarket, altTeamTotalLines, bookLabel, mapGameLinesSelectionToPick } from "@/lib/sharpapi/categorize";
import type { ResearchCategory, TeamBetPick } from "@/lib/sharpapi/types";

import { bookTagClass, nameGridCols, oddsCellClass, oddsCellMinWidth, priceClass } from "./researchOddsStyles";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

function formatSignedLine(line: number | null): string {
  if (line === null) return "";
  return line > 0 ? `+${line}` : `${line}`;
}

const tierButtonClass = `${oddsCellClass} ${oddsCellMinWidth}`;

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
  const teamTotalGroups = altTeamTotalLines(category, segment);

  if (spreadGroups.length === 0 && totalGroups.length === 0 && teamTotalGroups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {spreadGroups.length > 0 && (
        <CollapsibleSection title="Alternate Spreads">
          {spreadGroups.map(({ side, selections }) => {
            const teamName = side === Side.AWAY ? awayTeam : homeTeam;
            return (
              // Grid, not flex-wrap -- same overflow fix as ResearchPropTable: a bounded
              // name-column track can't be pushed past the viewport by a long team name.
              <Card key={side} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                <span className="min-w-0 text-sm font-medium">{teamName}</span>
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
                      <span className={bookTagClass}>{bookLabel(s.sportsbook)}</span>
                      <span>{formatSignedLine(s.line)}</span>
                      <span className={priceClass}>{formatPrice(s.priceAmerican)}</span>
                    </button>
                  )}
                />
              </Card>
            );
          })}
        </CollapsibleSection>
      )}

      {totalGroups.length > 0 && (
        <CollapsibleSection title="Alternate Totals">
          {totalGroups.map(({ side, selections }) => {
            const sideName = SIDE_LABELS[side] ?? side;
            return (
              <Card key={side} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                <span className="min-w-0 text-sm font-medium">{sideName}</span>
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
                      <span className={bookTagClass}>{bookLabel(s.sportsbook)}</span>
                      <span>{s.line}</span>
                      <span className={priceClass}>{formatPrice(s.priceAmerican)}</span>
                    </button>
                  )}
                />
              </Card>
            );
          })}
        </CollapsibleSection>
      )}

      {teamTotalGroups.length > 0 && (
        <CollapsibleSection title="Alternate Team Totals">
          {teamTotalGroups.map(({ teamSide, side, selections }) => {
            const teamName = teamSide === TeamSide.HOME ? homeTeam : awayTeam;
            const sideName = SIDE_LABELS[side] ?? side;
            const label = `${teamName} ${sideName}`;
            return (
              <Card key={`${teamSide}-${side}`} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                <span className="min-w-0 text-sm font-medium">{label}</span>
                <TierPager
                  items={selections}
                  keyFor={(s) => s.selectionId}
                  renderItem={(s) => (
                    <button
                      type="button"
                      className={tierButtonClass}
                      onClick={() => {
                        const pick = mapGameLinesSelectionToPick(game, "team_total", s);
                        if (pick) onSelectTeamBet(pick);
                      }}
                    >
                      <span className={bookTagClass}>{bookLabel(s.sportsbook)}</span>
                      <span>{s.line}</span>
                      <span className={priceClass}>{formatPrice(s.priceAmerican)}</span>
                    </button>
                  )}
                />
              </Card>
            );
          })}
        </CollapsibleSection>
      )}
    </div>
  );
}
