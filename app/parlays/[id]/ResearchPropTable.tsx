"use client";

import { useEffect, useState } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { TierPager } from "@/components/ui/TierPager";
import { getRostersForGame } from "@/lib/rosters/actions";
import { teamLogoUrl } from "@/lib/rosters/leagues";
import type { ResearchCategory, ResearchSelection, PropPick } from "@/lib/research/types";
import { bookLabel, propTypeLabel } from "@/lib/sharpapi/categorize";

import { bookTagClass, nameGridCols, nameGridColsOU, oddsCellClass, oddsCellMinWidth, priceClass } from "./researchOddsStyles";
import { TeamAvatar } from "./TeamMarketGrid";

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

const tierButtonClass = `${oddsCellClass} ${oddsCellMinWidth}`;

const ouColumnsClass = `grid ${nameGridColsOU} items-center gap-2`;

// A player's own team logo (circular, or an initial-letter fallback) to the left of their
// name -- resolved via the same roster lookup PlayerPropPicker/PickLegForm already use for
// manual prop entry, not a new data source. A roster-lookup miss (name mismatch) just
// leaves `team` null and falls back to TeamAvatar's own initial-circle treatment using the
// player's own initial instead of a team's -- never a crash, never a guess.
//
// Wraps onto a second line rather than truncating -- on a narrow phone there's no spare
// horizontal room to give a long name (e.g. "Jaxon Smith-Njigba"), but there's always
// vertical room, since each row's own height is free to grow. No `truncate`/`whitespace-
// nowrap` here at all: a name that fits stays on one line on its own: only one that doesn't
// wraps, at any viewport width.
function PlayerNameCell({ playerName, team, league }: { playerName: string; team: string | null; league: string }) {
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <span className="mt-0.5">
        <TeamAvatar logo={team ? teamLogoUrl(league, team) : null} name={team ?? playerName} />
      </span>
      <span className="min-w-0 text-sm font-medium">{playerName}</span>
    </span>
  );
}

// One row per player per stat -- DK distinguishes a pure tiered "ladder" (increasing Over
// thresholds only, paged a few at a time, e.g. "227+ / 230+ / 240+") from a separate,
// compact "<Stat> O/U" table showing just the single main line's Over and Under side by
// side. Splitting these (rather than one paged list mixing Over and Under of the same line
// together, which is what this looked like before) is what actually reproduces DK's real
// layout -- confirmed against the real reference screenshots.
export function ResearchPropTable({
  league,
  homeTeam,
  awayTeam,
  externalId,
  category,
  onSelectProp,
}: {
  league: string;
  homeTeam: string;
  awayTeam: string;
  externalId: string;
  category: ResearchCategory;
  onSelectProp: (pick: PropPick) => void;
}) {
  // Resolves which team each player belongs to, purely for the logo avatar -- the SharpAPI
  // prop rows themselves carry no team field (only team_total rows do). Reuses the same
  // roster action PlayerPropPicker already fetches from for manual entry, so this costs no
  // new network surface, just a second consumer of an already-cached (6h) roster fetch.
  const [teamByPlayer, setTeamByPlayer] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getRostersForGame(league, homeTeam, awayTeam).then((result) => {
      if (cancelled || "error" in result) return;
      setTeamByPlayer(new Map(result.players.map((p) => [p.name, p.team])));
    });
    return () => {
      cancelled = true;
    };
  }, [league, homeTeam, awayTeam]);

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
                <Card key={playerName} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                  <PlayerNameCell playerName={playerName} team={teamByPlayer.get(playerName) ?? null} league={league} />
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
                  <Card key={playerName} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                    <PlayerNameCell playerName={playerName} team={teamByPlayer.get(playerName) ?? null} league={league} />
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
                  <Card key={playerName} elevated className={`${ouColumnsClass} p-2`}>
                    <PlayerNameCell playerName={playerName} team={teamByPlayer.get(playerName) ?? null} league={league} />
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
