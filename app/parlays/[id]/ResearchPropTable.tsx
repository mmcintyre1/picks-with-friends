"use client";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { TierPager } from "@/components/ui/TierPager";
import type { ResearchCategory, ResearchSelection, PropPick } from "@/lib/sharpapi/types";
import { bookLabel, propTypeLabel } from "@/lib/sharpapi/categorize";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// A null line means a single-outcome "will this player do X" market (confirmed real: first/
// last touchdown scorer) -- selection.selection there just repeats the player's own name,
// which is redundant with the row header already showing it, so show "Yes" instead.
function sideLabel(selection: ResearchSelection): string {
  if (selection.line === null) return "Yes";
  return selection.selection || "Bet";
}

function buildPick(
  selection: ResearchSelection,
  playerName: string,
  propType: string,
  homeTeam: string,
  awayTeam: string,
  externalId: string,
): PropPick {
  return {
    homeTeam,
    awayTeam,
    // A null line (first/last touchdown scorer) is a genuine yes/no prop, not an
    // over/under one -- same distinction manual entry makes via the Prop shape toggle.
    market: selection.line === null ? Market.PLAYER_PROP_YESNO : Market.PLAYER_PROP,
    side: selection.side,
    line: selection.line,
    price: selection.priceAmerican,
    externalId,
    playerName,
    propType,
  };
}

// The line/price are what actually matters when scanning a board -- the sportsbook is
// secondary context, so it's a small corner tag rather than its own line competing with the
// odds for space. min-w shrinks below sm: so tiers still compress into the grid's 1fr
// column(s) on a 360-375px phone.
const tierButtonClass =
  "relative flex w-full min-w-[4.5rem] sm:min-w-[6rem] flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2.5 pt-3.5 pb-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10";
const bookTagClass = "absolute right-1 top-1 text-[8px] leading-none text-subtle";
const priceClass = "font-display text-base tracking-wide text-accent tabular-nums";

const ouColumnsClass = "grid grid-cols-[minmax(4.5rem,7rem)_1fr_1fr] items-center gap-2";

// One row per player per stat -- DK distinguishes a pure tiered "ladder" (increasing Over
// thresholds only, paged a few at a time, e.g. "227+ / 230+ / 240+") from a separate,
// compact "<Stat> O/U" table showing just the single main line's Over and Under side by
// side. Splitting these (rather than one paged list mixing Over and Under of the same line
// together, which is what this looked like before) is what actually reproduces DK's real
// layout -- confirmed against the real reference screenshots.
export function ResearchPropTable({
  homeTeam,
  awayTeam,
  externalId,
  category,
  onSelectProp,
}: {
  homeTeam: string;
  awayTeam: string;
  externalId: string;
  category: ResearchCategory;
  onSelectProp: (pick: PropPick) => void;
}) {
  const groups = category.marketGroups.filter((g) => g.segment === null);

  if (groups.length === 0) {
    return <p className="text-xs text-muted">No props posted in this category yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const label = propTypeLabel(group.marketType) ?? group.marketType;
        const byPlayer = new Map<string, ResearchSelection[]>();
        for (const selection of group.selections) {
          if (!selection.playerName) continue;
          const list = byPlayer.get(selection.playerName) ?? [];
          list.push(selection);
          byPlayer.set(selection.playerName, list);
        }

        const hasOverUnderShape = group.selections.some((s) => s.side === Side.OVER || s.side === Side.UNDER);

        // Single-outcome markets (first/last touchdown scorer, line: null) have no
        // ladder/O-U concept at all -- always exactly one real selection per player, so no
        // pager chrome either, just one flat section of plain buttons.
        if (!hasOverUnderShape) {
          return (
            <CollapsibleSection key={group.marketType} title={label}>
              {[...byPlayer.entries()].map(([playerName, selections]) => (
                <Card key={playerName} className="grid grid-cols-[minmax(4.5rem,7rem)_1fr] items-center gap-2 p-2">
                  <span className="min-w-0 truncate text-sm font-medium" title={playerName}>
                    {playerName}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selections.map((selection) => (
                      <button
                        key={selection.selectionId}
                        type="button"
                        className={tierButtonClass}
                        onClick={() => onSelectProp(buildPick(selection, playerName, label, homeTeam, awayTeam, externalId))}
                      >
                        <span className={bookTagClass}>{bookLabel(selection.sportsbook)}</span>
                        <span>{sideLabel(selection)}</span>
                        <span className={priceClass}>{formatPrice(selection.priceAmerican)}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </CollapsibleSection>
          );
        }

        // Ladder: every Over-side tier for players who have more than one -- a single tier
        // is just the O/U section's Over button again, not a real ladder to page through.
        const ladderRows = [...byPlayer.entries()]
          .map(([playerName, selections]) => ({
            playerName,
            tiers: [...selections.filter((s) => s.side === Side.OVER)].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
          }))
          .filter((r) => r.tiers.length >= 2);

        // O/U: every player's single main-line Over + Under pair, shown as a compact table
        // (a "Player / Over / Under" header once, then one row per player) rather than
        // repeating the word "Over"/"Under" inside every cell.
        const ouRows = [...byPlayer.entries()]
          .map(([playerName, selections]) => ({
            playerName,
            over: selections.find((s) => s.side === Side.OVER && s.isMainLine),
            under: selections.find((s) => s.side === Side.UNDER && s.isMainLine),
          }))
          .filter((r) => r.over || r.under);

        return (
          <div key={group.marketType} className="flex flex-col gap-2">
            {ladderRows.length > 0 && (
              <CollapsibleSection title={label}>
                {ladderRows.map(({ playerName, tiers }) => (
                  <Card key={playerName} className="grid grid-cols-[minmax(4.5rem,7rem)_1fr] items-center gap-2 p-2">
                    <span className="min-w-0 truncate text-sm font-medium" title={playerName}>
                      {playerName}
                    </span>
                    <TierPager
                      items={tiers}
                      keyFor={(s) => s.selectionId}
                      renderItem={(s) => (
                        <button
                          type="button"
                          className={tierButtonClass}
                          onClick={() => onSelectProp(buildPick(s, playerName, label, homeTeam, awayTeam, externalId))}
                        >
                          <span className={bookTagClass}>{bookLabel(s.sportsbook)}</span>
                          <span>{s.line}+</span>
                          <span className={priceClass}>{formatPrice(s.priceAmerican)}</span>
                        </button>
                      )}
                    />
                  </Card>
                ))}
              </CollapsibleSection>
            )}

            {ouRows.length > 0 && (
              <CollapsibleSection title={`${label} O/U`}>
                <div className={`${ouColumnsClass} px-1 text-[10px] font-medium uppercase tracking-wide text-subtle`}>
                  <span>Player</span>
                  <span className="text-center">Over</span>
                  <span className="text-center">Under</span>
                </div>
                {ouRows.map(({ playerName, over, under }) => (
                  <Card key={playerName} className={`${ouColumnsClass} p-2`}>
                    <span className="min-w-0 truncate text-sm font-medium" title={playerName}>
                      {playerName}
                    </span>
                    {over ? (
                      <button
                        type="button"
                        className={tierButtonClass}
                        onClick={() => onSelectProp(buildPick(over, playerName, label, homeTeam, awayTeam, externalId))}
                      >
                        <span className={bookTagClass}>{bookLabel(over.sportsbook)}</span>
                        <span>O {over.line}</span>
                        <span className={priceClass}>{formatPrice(over.priceAmerican)}</span>
                      </button>
                    ) : (
                      <span />
                    )}
                    {under ? (
                      <button
                        type="button"
                        className={tierButtonClass}
                        onClick={() => onSelectProp(buildPick(under, playerName, label, homeTeam, awayTeam, externalId))}
                      >
                        <span className={bookTagClass}>{bookLabel(under.sportsbook)}</span>
                        <span>U {under.line}</span>
                        <span className={priceClass}>{formatPrice(under.priceAmerican)}</span>
                      </button>
                    ) : (
                      <span />
                    )}
                  </Card>
                ))}
              </CollapsibleSection>
            )}
          </div>
        );
      })}
    </div>
  );
}
