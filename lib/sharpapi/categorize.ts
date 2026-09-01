import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";

import type {
  ResearchCategory,
  ResearchCategoryKey,
  ResearchGame,
  ResearchGameSummary,
  ResearchMarketGroup,
  ResearchSelection,
  SharpApiRow,
  TeamBetPick,
} from "./types";

// Confirmed by real fetches during Phase 2.14 implementation (the four quarter/half
// prefixes below were confirmed on a second real pull, deeper into the season, that
// surfaced games close enough to kickoff to have segment lines fully posted). Add more only
// once a real row confirms the exact string; a guessed prefix would silently strip nothing
// and leave a segment market miscategorized as a full-game one.
const SEGMENT_PREFIXES: { prefix: string; segment: string }[] = [
  { prefix: "1st_half_", segment: "1st_half" },
  { prefix: "2nd_half_", segment: "2nd_half" },
  { prefix: "1st_quarter_", segment: "1st_quarter" },
  { prefix: "2nd_quarter_", segment: "2nd_quarter" },
  { prefix: "3rd_quarter_", segment: "3rd_quarter" },
  { prefix: "4th_quarter_", segment: "4th_quarter" },
];

export function stripSegmentPrefix(marketType: string): { base: string; segment: string | null } {
  for (const { prefix, segment } of SEGMENT_PREFIXES) {
    if (marketType.startsWith(prefix)) return { base: marketType.slice(prefix.length), segment };
  }
  return { base: marketType, segment: null };
}

// Confirmed real market_type values for each bucket -- see the plan's "Verified this
// session" section. Anything not listed here (winning_margin, most_points_player,
// will_there_be_overtime, and any market_type not yet captured) falls to "uncategorized"
// rather than a guess. team_total is a specific team's own Over/Under -- its selection_type
// is a compound "home_over"/"away_under" shape, handled below in sideFromSelectionType/
// toSelection via the row's own team_side field (Market.TEAM_TOTAL, Leg.teamSide).
const GAME_LINES_BASE = new Set(["moneyline", "point_spread", "total_points", "team_total"]);
const PASSING_PREFIX = "player_passing";
const RECEIVING_PREFIXES = ["player_receiving", "player_receptions"];
const RUSHING_PREFIX = "player_rushing";
// player_touchdowns is a real Over/Under prop (e.g. "Over 1.5 TDs") that also carries
// separate "exact count" outright rows under the same market_type (selection_type "other",
// line null) -- those aren't wired (see sideFromSelectionType below), only its O/U rows
// are. first_touchdown_scorer/last_touchdown_scorer are confirmed real (SharpAPI's own
// stat_category on both is literally "anytime_td") but ship with is_player_prop: false
// despite having a real player_name -- category membership below checks market_type
// directly for these three rather than relying on is_player_prop.
const TD_SCORER_MARKETS = new Set(["player_touchdowns", "first_touchdown_scorer", "last_touchdown_scorer"]);
// These two are single-outcome "will this specific player do X" markets (confirmed real,
// selection_type "other", line null, no separate "no" row per player) -- the closest fit in
// the schema is PLAYER_PROP_YESNO's Side.YES, same shape already used for manual "Anytime
// TD" entry elsewhere in the app.
const OUTRIGHT_YES_MARKETS = new Set(["first_touchdown_scorer", "last_touchdown_scorer"]);

export function categorizeBaseMarket(base: string, row: SharpApiRow): ResearchCategoryKey {
  if (TD_SCORER_MARKETS.has(base)) return "td_scorers";
  if (row.is_player_prop) {
    if (base.startsWith(PASSING_PREFIX)) return "passing";
    if (RECEIVING_PREFIXES.some((p) => base.startsWith(p))) return "receiving";
    if (base.startsWith(RUSHING_PREFIX)) return "rushing";
    return "uncategorized";
  }
  if (GAME_LINES_BASE.has(base)) return "game_lines";
  return "uncategorized";
}

// Display labels for the confirmed player-prop market_types, matching
// lib/rosters/propTypes.ts's NFL strings exactly so a research-sourced pick's propType text
// is indistinguishable from one entered manually.
const PROP_TYPE_LABELS: Record<string, string> = {
  player_passing_yards: "Passing Yards",
  player_passing_touchdowns: "Passing TDs",
  player_receiving_yards: "Receiving Yards",
  player_receptions: "Receptions",
  player_rushing_yards: "Rushing Yards",
  // "Total TDs", not "Touchdowns" -- this is a real Over/Under-count market (e.g. "Over 1.5
  // TDs"), a genuinely different bet from the single-outcome "did they score at all"
  // markets (1st/Last TD Scorer) sitting right next to it in the same TD Scorers category.
  // The plain "Touchdowns" label read as if it might be the same kind of bet as those.
  player_touchdowns: "Total TDs",
  first_touchdown_scorer: "1st TD Scorer",
  last_touchdown_scorer: "Last TD Scorer",
};

export function propTypeLabel(base: string): string | null {
  return PROP_TYPE_LABELS[base] ?? null;
}

// selection_type values confirmed on real full-game/segment team markets and player-prop
// markets. "other" is ambiguous across markets (winning_margin's range bets and
// player_touchdowns' exact-count outrights both use it too) so it's only ever accepted for
// the two whitelisted single-outcome markets above, not generically. team_total's real
// selection_type values are the compound "home_over"/"home_under"/"away_over"/"away_under"
// (confirmed real, never bare "home"/"over" etc.) -- the team half is read separately off
// the row's own team_side field in toSelection below, not parsed out of this string.
function sideFromSelectionType(selectionType: string, marketType: string): Side | null {
  switch (selectionType) {
    case "home":
      return Side.HOME;
    case "away":
      return Side.AWAY;
    case "over":
    case "home_over":
    case "away_over":
      return Side.OVER;
    case "under":
    case "home_under":
    case "away_under":
      return Side.UNDER;
    case "other":
      return OUTRIGHT_YES_MARKETS.has(marketType) ? Side.YES : null;
    default:
      return null;
  }
}

function toSelection(row: SharpApiRow): ResearchSelection | null {
  const side = sideFromSelectionType(row.selection_type, row.market_type);
  if (!side) return null;
  return {
    selectionId: row.id,
    selection: row.selection,
    line: row.line,
    priceAmerican: row.odds_american,
    side,
    playerName: row.player_name ?? null,
    isMainLine: row.is_main_line ?? true,
    sportsbook: row.sportsbook,
    teamSide: row.team_side === "home" ? TeamSide.HOME : row.team_side === "away" ? TeamSide.AWAY : null,
  };
}

// Short display labels for the two books this app currently queries (SharpAPI's free tier
// caps a single request at 2 books -- see sharpApiProvider.ts). Falls back to the raw
// sportsbook string, capitalized, for anything else so a future book addition doesn't need
// a matching label added here to just work.
const BOOK_LABELS: Record<string, string> = {
  draftkings: "DK",
  fanduel: "FD",
};

export function bookLabel(sportsbook: string): string {
  return BOOK_LABELS[sportsbook] ?? sportsbook.charAt(0).toUpperCase() + sportsbook.slice(1);
}

// Folds SharpAPI's flat row list into one tree per real game: event -> category -> market
// group -> selections. Futures/season-long markets (SharpAPI reports them as a fake
// "event" with an empty away_team, e.g. "NFL Specials") are dropped entirely here -- there's
// no real game to attach a pick to.
export function groupRowsByGame(rows: SharpApiRow[]): ResearchGame[] {
  const gameRows = rows.filter((r) => r.home_team && r.away_team);

  const byEvent = new Map<string, SharpApiRow[]>();
  for (const row of gameRows) {
    const list = byEvent.get(row.event_id) ?? [];
    list.push(row);
    byEvent.set(row.event_id, list);
  }

  const games: ResearchGame[] = [];
  for (const [externalId, eventRows] of byEvent) {
    const first = eventRows[0];

    // category -> "marketType|segment" -> group
    const categoryMap = new Map<ResearchCategoryKey, Map<string, ResearchMarketGroup>>();

    for (const row of eventRows) {
      const selection = toSelection(row);
      if (!selection) continue;

      const { base, segment } = stripSegmentPrefix(row.market_type);
      const categoryKey = categorizeBaseMarket(base, row);

      const groups = categoryMap.get(categoryKey) ?? new Map<string, ResearchMarketGroup>();
      categoryMap.set(categoryKey, groups);

      const groupKey = `${base}|${segment ?? ""}`;
      const group = groups.get(groupKey) ?? { marketType: base, segment, selections: [] };
      group.selections.push(selection);
      groups.set(groupKey, group);
    }

    const categories: ResearchCategory[] = [...categoryMap.entries()].map(([key, groups]) => ({
      key,
      marketGroups: [...groups.values()],
    }));

    // An event whose every row had an unrecognized selection_type (e.g. winning_margin's
    // "other") ends up with zero categories -- skip it rather than surfacing a game with
    // nothing pickable on it.
    if (categories.length === 0) continue;

    games.push({
      externalId,
      homeTeam: first.home_team,
      awayTeam: first.away_team,
      commenceTime: first.event_start_time,
      categories,
    });
  }

  return games.sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
}

// Turns the cheap moneyline-filtered schedule rows into a plain list of real games, one
// entry per event_id -- this is what ResearchBrowser lists before any per-game odds are
// fetched. Rows with no away_team (there shouldn't be any -- moneyline is a real-game-only
// market -- but this mirrors groupRowsByGame's same defensive filter) are dropped.
export function summarizeSchedule(rows: SharpApiRow[]): ResearchGameSummary[] {
  const byEvent = new Map<string, SharpApiRow>();
  for (const row of rows) {
    if (!row.home_team || !row.away_team) continue;
    if (!byEvent.has(row.event_id)) byEvent.set(row.event_id, row);
  }
  return [...byEvent.values()]
    .map((row) => ({
      externalId: row.event_id,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      commenceTime: row.event_start_time,
    }))
    .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
}

// Alternate (non-main) lines for a market_type + segment -- point_spread/total_points only,
// since those are the two Game Lines markets with a clean Market/Side mapping (team_total's
// compound selection_type has none, see the comment on GAME_LINES_BASE above). Grouped by
// side because a single side can carry several alternate lines (confirmed real: up to a few
// per side on a segment spread).
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

// Builds the full categorized ResearchGame for one specific event's rows (already scoped to
// a single event_id by the caller, via a real per-event SharpAPI fetch). A thin wrapper
// around groupRowsByGame's per-event logic rather than a duplicate implementation.
export function buildResearchGame(rows: SharpApiRow[]): ResearchGame | null {
  return groupRowsByGame(rows)[0] ?? null;
}

// Maps one Game Lines selection (moneyline/point_spread/total_points, full game only -- no
// segment) into the shape PickLegForm's slip expects. Returns null for anything this
// function doesn't recognize (a segment market, or a market_type outside the confirmed
// three) rather than guessing -- ResearchNumberedGrid only ever calls this with rows already
// known to be full-game Game Lines, so null here would indicate a real bug, not an
// expected case.
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
// has no team_total group for the given segment (most segments outside full-game/halves).
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
