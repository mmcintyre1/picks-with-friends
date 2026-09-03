import { Side } from "@/app/generated/prisma/enums";
import { normalizePlayerName, hitRate, type HitRate } from "@/lib/playerstats/gamelogStats";
import type { PlayerLogs } from "@/lib/playerstats/types";
import { propTypeLabel } from "@/lib/sharpapi/categorize";

import type { ResearchCategory, ResearchCategoryKey, ResearchMarketGroup, ResearchSelection } from "./types";

// Matches the "L8" convention this app's own hit-rate dots use everywhere (see
// components/ui/HitRateDots.tsx's own comment for why 10 was dropped to 8 -- a real mobile
// overflow bug, not a design preference). Shared here so the category-first
// (ResearchPropTable) and player-first (app/research/PlayerBoard) views always agree on the
// same real recent-games window instead of silently drifting apart.
export const HIT_RATE_GAMES = 8;

// A single-outcome market's real numeric line is always reported as 0 by every vendor this
// app pulls from (confirmed real for both ParlayAPI and SportsGameOdds' Anytime TD rows) --
// but "0" isn't the real betting threshold, it's a placeholder for "did this happen at all,"
// i.e. at least one occurrence. Feeding a real 0 into the hit-rate math would make every
// non-negative stat "hit" 100% of the time, which is meaningless. categorize.ts already
// drops that placeholder (selection.line is null for these), so null is treated as "1" here
// -- the real intent of a yes/no counting stat -- rather than re-deriving it from the raw 0.
export function effectiveLine(selection: ResearchSelection): number {
  return selection.line ?? 1;
}

export function computeHitRate(
  logsByPlayer: Map<string, PlayerLogs>,
  playerName: string,
  propType: string,
  selection: ResearchSelection,
): HitRate | null {
  const entries = logsByPlayer.get(playerName)?.logs.find((l) => l.propType === propType)?.entries;
  if (!entries) return null;
  return hitRate(entries, effectiveLine(selection), selection.side, HIT_RATE_GAMES);
}

// One player's props for ONE market group, split the same DK-shaped way
// ResearchPropTable.tsx already established: a pure Over-only tiered ladder (2+ real tiers)
// is kept separate from a compact single-main-line Over/Under pair, and a single-outcome
// market (no real O/U shape at all, e.g. first/last TD scorer) gets neither -- see that
// file's own comment for why mixing ladder and O/U reads wrong against a real DK reference
// screenshot.
export type PlayerPropEntry = {
  categoryKey: ResearchCategoryKey;
  propType: string;
  ladderTiers: ResearchSelection[]; // 2+ real Over tiers, [] if this player has none
  over: ResearchSelection | undefined; // main-line Over, if any
  under: ResearchSelection | undefined; // main-line Under, if any
  single: ResearchSelection | undefined; // a single-outcome selection, if this market has no O/U shape
};

export type PlayerPropBoard = {
  playerName: string;
  entries: PlayerPropEntry[];
};

// Keyed by normalizePlayerName, not the raw vendor string -- federating three providers
// (lib/research/actions.ts's getNflGameOdds) means the SAME real player can show up under
// two different spellings within one game's data (confirmed real: "A.J. Barner" from one
// provider, "AJ Barner" from another; "DeMario Douglas" vs "Demario Douglas"). Grouping by
// the raw string rendered that as two separate player cards for the same real person --
// normalizing here is the same fix already applied to the roster/hit-rate lookups earlier
// this session, just needed a third time at the point selections first get grouped by
// player at all.
function entriesForGroup(categoryKey: ResearchCategoryKey, group: ResearchMarketGroup): Map<string, { displayName: string; entry: PlayerPropEntry }> {
  const label = propTypeLabel(group.marketType) ?? group.marketType;
  const byPlayer = new Map<string, { displayName: string; selections: ResearchSelection[] }>();
  for (const selection of group.selections) {
    if (!selection.playerName) continue;
    const key = normalizePlayerName(selection.playerName);
    const existing = byPlayer.get(key);
    if (existing) existing.selections.push(selection);
    else byPlayer.set(key, { displayName: selection.playerName, selections: [selection] });
  }

  const hasOverUnderShape = group.selections.some((s) => s.side === Side.OVER || s.side === Side.UNDER);
  const result = new Map<string, { displayName: string; entry: PlayerPropEntry }>();

  for (const [key, { displayName, selections }] of byPlayer) {
    if (!hasOverUnderShape) {
      result.set(key, { displayName, entry: { categoryKey, propType: label, ladderTiers: [], over: undefined, under: undefined, single: selections[0] } });
      continue;
    }
    const tiers = selections.filter((s) => s.side === Side.OVER).sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    result.set(key, {
      displayName,
      entry: {
        categoryKey,
        propType: label,
        ladderTiers: tiers.length >= 2 ? tiers : [],
        over: selections.find((s) => s.side === Side.OVER && s.isMainLine),
        under: selections.find((s) => s.side === Side.UNDER && s.isMainLine),
        single: undefined,
      },
    });
  }

  return result;
}

// Regroups every prop category's market groups by PLAYER instead of by category/stat -- the
// actual axis PocketProps' own player pages use ("everything about this one player,
// together") vs. this app's existing category-first ResearchPropTable ("everyone's
// Receiving Yards, together"). Reuses the exact same per-group ladder/O-U split
// ResearchPropTable.tsx already established (entriesForGroup, above), just folded across
// every category instead of one at a time. Skips "game_lines" (team markets, not player
// props) and any segment-scoped group (1st half/quarter splits) -- the player board is a
// full-game view, matching what the ladder/O-U split was originally built against.
export function groupPropsByPlayer(categories: ResearchCategory[]): PlayerPropBoard[] {
  const byPlayer = new Map<string, { displayName: string; entries: PlayerPropEntry[] }>();

  for (const category of categories) {
    if (category.key === "game_lines") continue;
    for (const group of category.marketGroups.filter((g) => g.segment === null)) {
      for (const [key, { displayName, entry }] of entriesForGroup(category.key, group)) {
        const existing = byPlayer.get(key);
        if (existing) existing.entries.push(entry);
        else byPlayer.set(key, { displayName, entries: [entry] });
      }
    }
  }

  return [...byPlayer.values()]
    .map(({ displayName, entries }) => ({ playerName: displayName, entries }))
    .sort((a, b) => a.playerName.localeCompare(b.playerName));
}
