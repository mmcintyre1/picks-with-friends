"use client";

import { TeamSide } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { bookLabel, mainTeamTotalLines, mapGameLinesSelectionToPick } from "@/lib/sharpapi/categorize";
import type { ResearchCategory, ResearchSelection, TeamBetPick } from "@/lib/sharpapi/types";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// Same local styling as ResearchAltLines/ResearchPropTable -- the book is secondary context
// to the line/price, so it's a small corner tag rather than its own line.
const tierButtonClass =
  "relative flex w-full min-w-[4rem] sm:min-w-[5.5rem] flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2.5 pt-3.5 pb-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10";
const bookTagClass = "absolute right-1 top-1 text-[8px] leading-none text-subtle";
const priceClass = "font-display text-base tracking-wide text-accent tabular-nums";

function TeamTotalButton({
  selection,
  label,
  onSelect,
}: {
  selection: ResearchSelection | undefined;
  label: string;
  onSelect: (selection: ResearchSelection) => void;
}) {
  if (!selection) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border/50 px-2.5 py-3 text-sm text-subtle">
        —
      </div>
    );
  }
  return (
    <button type="button" className={`flex-1 ${tierButtonClass}`} onClick={() => onSelect(selection)}>
      <span className={bookTagClass}>{bookLabel(selection.sportsbook)}</span>
      <span>{label}</span>
      <span className={priceClass}>{formatPrice(selection.priceAmerican)}</span>
    </button>
  );
}

// A specific team's own point total, Over/Under a line -- distinct from the shared
// game-wide Total already shown in ResearchNumberedGrid. Kept as its own collapsible
// section below the main grid rather than a 5th grid column, to avoid reopening the
// mobile-overflow issue Phase 2.15 fixed on that same 4-column grid.
export function ResearchTeamTotals({
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
  const rows = mainTeamTotalLines(category, segment);
  const hasAnySelection = rows.some((r) => r.overSelection || r.underSelection);
  if (!hasAnySelection) return null;

  function select(selection: ResearchSelection) {
    const pick = mapGameLinesSelectionToPick(game, "team_total", selection);
    if (pick) onSelectTeamBet(pick);
  }

  return (
    <CollapsibleSection title="Team Totals">
      <div className="flex flex-col gap-2">
        {rows.map(({ teamSide, overSelection, underSelection }) => {
          const teamName = teamSide === TeamSide.HOME ? homeTeam : awayTeam;
          if (!overSelection && !underSelection) return null;
          return (
            <Card key={teamSide} className="grid grid-cols-[minmax(4.5rem,7rem)_1fr] items-center gap-2 p-2">
              <span className="min-w-0 truncate text-sm font-medium" title={teamName}>
                {teamName}
              </span>
              <div className="flex gap-1.5">
                <TeamTotalButton
                  selection={overSelection}
                  label={overSelection ? `O ${overSelection.line}` : "O"}
                  onSelect={select}
                />
                <TeamTotalButton
                  selection={underSelection}
                  label={underSelection ? `U ${underSelection.line}` : "U"}
                  onSelect={select}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
