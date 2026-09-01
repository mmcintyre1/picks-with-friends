"use client";

import { Fragment } from "react";

import { TeamSide } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { teamLogoUrl } from "@/lib/rosters/leagues";
import { bookLabel, mainTeamTotalLines, mapGameLinesSelectionToPick } from "@/lib/sharpapi/categorize";
import type { ResearchCategory, ResearchSelection, TeamBetPick } from "@/lib/sharpapi/types";

import { bookTagClass, columnHeaderClass, oddsCellClass, priceClass } from "./researchOddsStyles";
import { TeamLabel } from "./TeamMarketGrid";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// Same emptyCellClass treatment as ResearchNumberedGrid's missing-selection state.
const emptyCellClass = "flex items-center justify-center rounded-lg border border-border/50 px-1.5 py-2 text-xs text-subtle";

function TeamTotalCell({
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
    <button type="button" className={oddsCellClass} onClick={() => onSelect(selection)}>
      <span className={bookTagClass}>{bookLabel(selection.sportsbook)}</span>
      <span>{label}</span>
      <span className={priceClass}>{formatPrice(selection.priceAmerican)}</span>
    </button>
  );
}

// A specific team's own point total, Over/Under a line -- distinct from the shared
// game-wide Total already shown in ResearchNumberedGrid. Deliberately mirrors that grid's
// exact shape (one shared Card, a column-header row, TeamLabel with a real logo per row)
// rather than its own independently-styled per-team cards -- the two used to look like
// different formats entirely; now Team Totals is just a second, shorter Game Lines-style
// grid, not a new visual language. Same 3-columns-squeezed-together reasoning as
// ResearchNumberedGrid applies here too, so these buttons don't get an extra min-width
// floor either -- the grid's own `minmax(0, 1fr)` tracks handle the narrow-phone case.
export function ResearchTeamTotals({
  league,
  homeTeam,
  awayTeam,
  externalId,
  category,
  segment,
  onSelectTeamBet,
}: {
  league: string;
  homeTeam: string;
  awayTeam: string;
  externalId: string;
  category: ResearchCategory;
  segment: string | null;
  onSelectTeamBet: (pick: TeamBetPick) => void;
}) {
  const game = { homeTeam, awayTeam, externalId };
  const rows = mainTeamTotalLines(category, segment);
  const hasAnySelection = rows.some((r) => r.overSelection || r.underSelection);
  if (!hasAnySelection) return null;

  function select(selection: ResearchSelection) {
    const pick = mapGameLinesSelectionToPick(game, "team_total", selection);
    if (pick) onSelectTeamBet(pick);
  }

  return (
    <CollapsibleSection title="Team Totals">
      <Card elevated className="grid w-full min-w-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-x-1.5 gap-y-2 overflow-hidden p-2">
        <span />
        <span className={columnHeaderClass}>Over</span>
        <span className={columnHeaderClass}>Under</span>

        {rows.map(({ teamSide, overSelection, underSelection }) => {
          const teamName = teamSide === TeamSide.HOME ? homeTeam : awayTeam;
          if (!overSelection && !underSelection) return null;
          return (
            <Fragment key={teamSide}>
              <span className="flex min-w-0 items-center">
                <TeamLabel name={teamName} logo={teamLogoUrl(league, teamName)} league={league} />
              </span>
              <TeamTotalCell
                selection={overSelection}
                label={overSelection ? `O ${overSelection.line}` : "O"}
                onSelect={select}
              />
              <TeamTotalCell
                selection={underSelection}
                label={underSelection ? `U ${underSelection.line}` : "U"}
                onSelect={select}
              />
            </Fragment>
          );
        })}
      </Card>
    </CollapsibleSection>
  );
}
