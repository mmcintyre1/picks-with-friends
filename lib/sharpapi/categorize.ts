import { Side, TeamSide } from "@/app/generated/prisma/enums";
import type { ResearchCategoryKey, ResearchGame, ResearchGameSummary, ResearchSelection } from "@/lib/research/types";
import type { CategorizedSelection } from "@/lib/research/marketUtils";
import { buildResearchGameFromSelections } from "@/lib/research/marketUtils";

import type { SharpApiRow } from "./types";

// Re-exported so every existing consumer of these shared, vendor-agnostic utilities (all
// four Research* UI components) keeps importing them from this same module -- the functions
// themselves now live in lib/research/marketUtils.ts so lib/sportsgameodds/categorize.ts can
// reuse them too, without every UI import path needing to change.
export {
  altLinesForMarket,
  altTeamTotalLines,
  bookLabel,
  mainTeamTotalLines,
  mapGameLinesSelectionToPick,
  propTypeLabel,
} from "@/lib/research/marketUtils";

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

// Folds SharpAPI's flat row list into one tree per real game: event -> category -> market
// group -> selections (the actual tree-building now lives in the shared
// buildResearchGameFromSelections, reused by every provider). Futures/season-long markets
// (SharpAPI reports them as a fake "event" with an empty away_team, e.g. "NFL Specials") are
// dropped entirely here -- there's no real game to attach a pick to.
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

    const items: CategorizedSelection[] = [];
    for (const row of eventRows) {
      const selection = toSelection(row);
      if (!selection) continue;
      const { base, segment } = stripSegmentPrefix(row.market_type);
      items.push({ selection, marketType: base, segment, categoryKey: categorizeBaseMarket(base, row) });
    }

    const game = buildResearchGameFromSelections(
      { externalId, homeTeam: first.home_team, awayTeam: first.away_team, commenceTime: first.event_start_time },
      items,
    );
    // A game whose every row had an unrecognized selection_type (e.g. winning_margin's
    // "other") builds no categories -- skip it rather than surfacing a game with nothing
    // pickable on it.
    if (game) games.push(game);
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
      source: "sharpapi" as const,
    }))
    .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
}

// Builds the full categorized ResearchGame for one specific event's rows (already scoped to
// a single event_id by the caller, via a real per-event SharpAPI fetch). A thin wrapper
// around groupRowsByGame's per-event logic rather than a duplicate implementation.
export function buildResearchGame(rows: SharpApiRow[]): ResearchGame | null {
  return groupRowsByGame(rows)[0] ?? null;
}
