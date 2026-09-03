import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";

import type {
  ResearchCategory,
  ResearchCategoryKey,
  ResearchGame,
  ResearchMarketGroup,
  ResearchSelection,
  TeamBetPick,
} from "./types";

// Combines several providers' already-built ResearchGames for the SAME real-world game into
// one -- the federation this whole shared-vocabulary architecture was built to make cheap.
// `games[0]` (by convention, PROVIDER_ORDER's own priority order -- see
// lib/research/actions.ts) supplies the matchup identity (externalId/teams/commenceTime);
// every other game's categories/marketGroups/selections are folded in underneath it.
//
// Deduplication matters here: two providers reporting the SAME real book's SAME real bet
// (e.g. both ParlayAPI and SportsGameOdds happen to carry DraftKings' current Passing Yards
// line for the same QB) must not render as two identical-looking buttons. The dedupe key
// deliberately includes `line` -- a market's own alt-line/milestone tiers legitimately share
// every other field (book/side/isMainLine/player) while differing only in line, so dropping
// `line` from the key would wrongly collapse a real tiered ladder down to one tier.
function selectionDedupeKey(selection: ResearchSelection): string {
  return [selection.sportsbook, selection.side, selection.isMainLine, selection.playerName ?? "", selection.teamSide ?? "", selection.line ?? ""].join("|");
}

export function mergeResearchGames(games: ResearchGame[]): ResearchGame {
  const base = games[0];
  const categoryGroups = new Map<ResearchCategoryKey, Map<string, ResearchMarketGroup>>();
  const seen = new Set<string>();

  for (const game of games) {
    for (const category of game.categories) {
      const groups = categoryGroups.get(category.key) ?? new Map<string, ResearchMarketGroup>();
      categoryGroups.set(category.key, groups);
      for (const group of category.marketGroups) {
        const groupKey = `${group.marketType}|${group.segment ?? ""}`;
        const existing = groups.get(groupKey) ?? { marketType: group.marketType, segment: group.segment, selections: [] };
        groups.set(groupKey, existing);
        for (const selection of group.selections) {
          const dedupeKey = `${category.key}|${groupKey}|${selectionDedupeKey(selection)}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          existing.selections.push(selection);
        }
      }
    }
  }

  const categories: ResearchCategory[] = [...categoryGroups.entries()].map(([key, groups]) => ({
    key,
    marketGroups: [...groups.values()],
  }));

  return { ...base, categories };
}

// Pure, vendor-agnostic utilities shared by every research provider's own categorize.ts
// (lib/sharpapi/categorize.ts, lib/sportsgameodds/categorize.ts, and any future provider).
// None of these touch a vendor's raw response shape -- they only ever read/write the shared
// ResearchGame/ResearchCategory/ResearchSelection types, so a new provider gets correct
// alt-line handling, team-total grouping, book labels, and pick-mapping for free just by
// producing selections tagged with the same canonical marketType strings established here,
// without reimplementing any of this.

// Canonical base marketType strings every provider's categorize.ts must translate its own
// raw market identifiers into -- these are the shared vocabulary the whole UI layer (and
// the functions below) key off, not any one vendor's own naming. Providers translate their
// own real, confirmed market identifiers into these; nothing here is guessed.
// "player_rush_rec_yards" and "player_anytime_touchdown" have no SharpAPI equivalent
// (confirmed real only for SportsGameOdds so far) -- added here rather than duplicated
// per-provider so a label/grading lookup only needs one entry to serve every provider that
// eventually confirms the same market.
const PROP_TYPE_LABELS: Record<string, string> = {
  player_passing_yards: "Passing Yards",
  player_passing_touchdowns: "Passing TDs",
  player_passing_touchdowns_anytime: "Passing TDs",
  player_receiving_yards: "Receiving Yards",
  player_receptions: "Receptions",
  player_rushing_yards: "Rushing Yards",
  player_rush_rec_yards: "Rush + Rec Yards",
  // "Total TDs", not "Touchdowns" -- a real Over/Under-count market (e.g. "Over 1.5 TDs"),
  // genuinely different from the single-outcome "did they score at all" markets (Anytime
  // TD, 1st/Last TD Scorer) sitting right next to it in the same TD Scorers category.
  player_touchdowns: "Total TDs",
  player_anytime_touchdown: "Anytime TD",
  first_touchdown_scorer: "1st TD Scorer",
  last_touchdown_scorer: "Last TD Scorer",
  // Confirmed real via a deeper SportsGameOdds pull (Phase 2.19 follow-up) that surfaced 27
  // distinct statIDs -- more than double the original narrower pull. Labels reuse the exact
  // canonical propType strings lib/rosters/propTypes.ts and lib/evaluate/statLabels.ts
  // already established for manual entry, so a research-sourced pick and a manually-typed
  // one for the same stat always carry the identical propType string.
  player_pass_attempts: "Pass Attempts",
  player_completions: "Completions",
  player_interceptions_thrown: "Interceptions Thrown",
  player_longest_completion: "Longest Completion",
  // A confirmed-real combined QB market (passing + rushing yards) -- no SharpAPI equivalent,
  // same "combo stat, one propType" treatment as player_rush_rec_yards above.
  player_pass_rush_yards: "Pass + Rush Yards",
  player_rushing_attempts: "Rushing Attempts",
  player_longest_rush: "Longest Rush",
  player_longest_reception: "Longest Reception",
  player_kicking_points: "Kicking Points",
  player_field_goals_made: "Field Goals Made",
  player_extra_points_made: "Extra Points Made",
  player_total_tackles: "Total Tackles",
  // No existing canonical propType/grading entry for solo vs. assisted alone (only the
  // combined "Total Tackles" was ever needed for manual entry) -- real, confirmed markets,
  // shipped for browsing/picking, graded manually only until a real need justifies adding
  // ESPN stat mappings for these two specifically.
  player_solo_tackles: "Solo Tackles",
  player_assisted_tackles: "Assisted Tackles",
};

export function propTypeLabel(base: string): string | null {
  return PROP_TYPE_LABELS[base] ?? null;
}

// Short display labels for the books this app queries. Falls back to the raw sportsbook
// string, capitalized, for anything else so a future book addition (or a new provider that
// covers different books) doesn't need a matching label added here to just work.
const BOOK_LABELS: Record<string, string> = {
  draftkings: "DK",
  fanduel: "FD",
};

export function bookLabel(sportsbook: string): string {
  return BOOK_LABELS[sportsbook] ?? sportsbook.charAt(0).toUpperCase() + sportsbook.slice(1);
}

// One already-categorized selection, ready to fold into a ResearchGame tree -- the shape
// every provider's categorize.ts reduces its own raw data down to before handing off to
// buildResearchGameFromSelections below.
export type CategorizedSelection = {
  selection: ResearchSelection;
  marketType: string; // canonical base string, see PROP_TYPE_LABELS above
  segment: string | null;
  categoryKey: ResearchCategoryKey;
};

// Folds one real event's already-categorized selections into the category -> market group
// tree every Research* UI component expects -- shared so the actual tree-shape logic (and
// its "no pickable categories means no real game" rule) exists exactly once regardless of
// how many providers eventually feed it.
export function buildResearchGameFromSelections(
  game: { externalId: string; homeTeam: string; awayTeam: string; commenceTime: string },
  items: CategorizedSelection[],
): ResearchGame | null {
  const categoryMap = new Map<ResearchCategoryKey, Map<string, ResearchMarketGroup>>();
  for (const { selection, marketType, segment, categoryKey } of items) {
    const groups = categoryMap.get(categoryKey) ?? new Map<string, ResearchMarketGroup>();
    categoryMap.set(categoryKey, groups);
    const groupKey = `${marketType}|${segment ?? ""}`;
    const group = groups.get(groupKey) ?? { marketType, segment, selections: [] };
    group.selections.push(selection);
    groups.set(groupKey, group);
  }

  const categories: ResearchCategory[] = [...categoryMap.entries()].map(([key, groups]) => ({
    key,
    marketGroups: [...groups.values()],
  }));
  if (categories.length === 0) return null;

  return { ...game, categories };
}

// Alternate (non-main) lines for a market_type + segment -- point_spread/total_points only,
// since those are the two Game Lines markets with a clean Market/Side mapping (team_total's
// compound shape has its own dedicated altTeamTotalLines below). Grouped by side because a
// single side can carry several alternate lines.
export function altLinesForMarket(
  category: ResearchCategory,
  marketType: "point_spread" | "total_points",
  segment: string | null,
): { side: Side; selections: ResearchSelection[] }[] {
  const group = category.marketGroups.find((g) => g.marketType === marketType && g.segment === segment);
  if (!group) return [];

  const bySide = new Map<Side, ResearchSelection[]>();
  for (const selection of group.selections) {
    if (selection.isMainLine) continue;
    const list = bySide.get(selection.side) ?? [];
    list.push(selection);
    bySide.set(selection.side, list);
  }

  return [...bySide.entries()]
    .map(([side, selections]) => ({ side, selections: selections.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)) }))
    .filter((g) => g.selections.length > 0);
}

// Maps one Game Lines selection (moneyline/point_spread/total_points/team_total, full game
// or a segment) into the shape PickLegForm's slip expects. Returns null for anything this
// function doesn't recognize rather than guessing.
export function mapGameLinesSelectionToPick(
  game: { homeTeam: string; awayTeam: string; externalId: string },
  marketType: string,
  selection: ResearchSelection,
): TeamBetPick | null {
  const market =
    marketType === "moneyline"
      ? Market.MONEYLINE
      : marketType === "point_spread"
        ? Market.SPREAD
        : marketType === "total_points"
          ? Market.TOTAL
          : marketType === "team_total"
            ? Market.TEAM_TOTAL
            : null;
  if (!market) return null;

  return {
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    market,
    side: selection.side,
    line: selection.line,
    price: selection.priceAmerican,
    externalId: game.externalId,
    teamSide: selection.teamSide ?? undefined,
  };
}

// Main-line team_total selections only, one entry per team -- feeds ResearchTeamTotals'
// display directly (no grouping logic needed in that component). Returns [] if this game
// has no team_total group for the given segment.
export function mainTeamTotalLines(
  category: ResearchCategory,
  segment: string | null,
): { teamSide: TeamSide; overSelection: ResearchSelection | undefined; underSelection: ResearchSelection | undefined }[] {
  const group = category.marketGroups.find((g) => g.marketType === "team_total" && g.segment === segment);
  if (!group) return [];

  const teamSides = [TeamSide.AWAY, TeamSide.HOME] as const;
  return teamSides.map((teamSide) => ({
    teamSide,
    overSelection:
      group.selections.find((s) => s.teamSide === teamSide && s.side === Side.OVER && s.isMainLine) ??
      group.selections.find((s) => s.teamSide === teamSide && s.side === Side.OVER),
    underSelection:
      group.selections.find((s) => s.teamSide === teamSide && s.side === Side.UNDER && s.isMainLine) ??
      group.selections.find((s) => s.teamSide === teamSide && s.side === Side.UNDER),
  }));
}

// Alternate (non-main) team_total lines, grouped by (teamSide, side) -- team_total genuinely
// has up to 4 independent alt-line groups (each team's Over and Under can each carry several
// alternate lines), unlike altLinesForMarket's 2-group (side-only) shape above.
export function altTeamTotalLines(
  category: ResearchCategory,
  segment: string | null,
): { teamSide: TeamSide; side: Side; selections: ResearchSelection[] }[] {
  const group = category.marketGroups.find((g) => g.marketType === "team_total" && g.segment === segment);
  if (!group) return [];

  const byKey = new Map<string, { teamSide: TeamSide; side: Side; selections: ResearchSelection[] }>();
  for (const selection of group.selections) {
    if (selection.isMainLine || !selection.teamSide) continue;
    const key = `${selection.teamSide}|${selection.side}`;
    const existing = byKey.get(key) ?? { teamSide: selection.teamSide, side: selection.side, selections: [] };
    existing.selections.push(selection);
    byKey.set(key, existing);
  }

  return [...byKey.values()]
    .map((g) => ({ ...g, selections: g.selections.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)) }))
    .filter((g) => g.selections.length > 0);
}
