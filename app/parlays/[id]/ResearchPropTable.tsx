"use client";

import { Market } from "@/app/generated/prisma/enums";
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

const tierButtonClass =
  "flex min-w-[5.5rem] flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10";

// One row per player per stat, tiered-line buttons side by side -- this is what naturally
// reproduces DK's "85+/-112, 90+/+108, 100+/+156" layout (see the reference screenshots),
// since it falls straight out of groupRowsByGame's grouping with no extra pairing logic.
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
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const label = propTypeLabel(group.marketType) ?? group.marketType;
        const byPlayer = new Map<string, ResearchSelection[]>();
        for (const selection of group.selections) {
          if (!selection.playerName) continue;
          const list = byPlayer.get(selection.playerName) ?? [];
          list.push(selection);
          byPlayer.set(selection.playerName, list);
        }

        return (
          <div key={`${group.marketType}-${group.segment ?? "full"}`} className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
            <div className="flex flex-col gap-2">
              {[...byPlayer.entries()].map(([playerName, selections]) => (
                <div key={playerName} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
                  <span className="min-w-0 shrink-0 truncate text-sm font-medium sm:w-32">{playerName}</span>
                  <div className="min-w-0 flex-1">
                    <TierPager
                      items={[...selections].sort((a, b) => (a.line ?? 0) - (b.line ?? 0))}
                      keyFor={(s) => s.selectionId}
                      renderItem={(selection) => (
                        <button
                          type="button"
                          className={`${tierButtonClass} w-full`}
                          onClick={() =>
                            onSelectProp({
                              homeTeam,
                              awayTeam,
                              // A null line (first/last touchdown scorer) is a genuine
                              // yes/no prop, not an over/under one -- same distinction
                              // manual entry makes via the Prop shape toggle.
                              market: selection.line === null ? Market.PLAYER_PROP_YESNO : Market.PLAYER_PROP,
                              side: selection.side,
                              line: selection.line,
                              price: selection.priceAmerican,
                              externalId,
                              playerName,
                              propType: label,
                            })
                          }
                        >
                          <span>{selection.line === null ? sideLabel(selection) : `${sideLabel(selection)} ${selection.line}`}</span>
                          <span className="font-display tracking-wide text-accent tabular-nums">
                            {formatPrice(selection.priceAmerican)}
                          </span>
                          <span className="text-[9px] text-subtle">{bookLabel(selection.sportsbook)}</span>
                        </button>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
