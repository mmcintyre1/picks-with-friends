import { Side } from "@/app/generated/prisma/enums";
import type { CategorizedSelection } from "@/lib/research/marketUtils";
import { buildResearchGameFromSelections } from "@/lib/research/marketUtils";
import type { ResearchCategoryKey, ResearchGame, ResearchGameSummary, ResearchSelection } from "@/lib/research/types";

import type { ParlayApiEvent, ParlayApiEventData, ParlayApiGameOdds, ParlayApiProp } from "./types";

// ParlayAPI's /props endpoint represents a tiered ladder as one SEPARATE market_key row per
// threshold (e.g. player_receiving_yards_milestones_100_or_more) rather than SharpAPI's
// is_main_line flag or SportsGameOdds' altLines[] array -- confirmed real via a live pull.
// Stripping this suffix recovers the base stat so every threshold folds into the same
// canonical marketType as the plain (non-milestone) main-line row, exactly like every other
// provider's alt-line handling. The row's own numeric `line` field is always already correct
// for the real threshold (e.g. 100), so no number needs parsing out of the key string itself.
function normalizeMarketKey(marketKey: string): string {
  return marketKey.replace(/_milestones(_\d+_or_more)?$/, "");
}

// Base market_key (after normalization) -> canonical marketType, reusing the exact same
// canonical vocabulary lib/sharpapi/categorize.ts and lib/sportsgameodds/categorize.ts
// already established, confirmed against a real live pull for this event.
function toMarketType(baseKey: string): string | null {
  switch (baseKey) {
    case "player_receiving_yards":
      return "player_receiving_yards";
    case "player_receptions":
      return "player_receptions";
    case "player_longest_reception":
      return "player_longest_reception";
    case "player_rushing_yards":
      return "player_rushing_yards";
    case "player_rushing_attempts":
      return "player_rushing_attempts";
    case "player_rushing_receiving_yards":
      return "player_rush_rec_yards";
    case "player_passing_yards":
      return "player_passing_yards";
    case "player_passing_attempts":
      return "player_pass_attempts";
    case "player_pass_completions":
      return "player_completions";
    case "player_passing_rushing_yards":
      return "player_pass_rush_yards";
    case "player_passing_tds":
      return "player_passing_touchdowns";
    case "player_interceptions":
      return "player_interceptions_thrown";
    case "player_anytime_touchdown_scorer":
      return "player_anytime_touchdown";
    case "player_first_touchdown_scorer":
      return "first_touchdown_scorer";
    case "player_last_touchdown_scorer":
      return "last_touchdown_scorer";
    default:
      // Deliberately unmapped, confirmed real but excluded for real reasons (not oversights):
      // player_total_touchdowns / player_moneyline / player_1st_half_* / player_1st_quarter_*
      // all carry a FAKE "player" field (a matchup string or generic label, e.g. "BUF Bills @
      // HOU Texans" or "1st half moneyline") with no real field to say which team/side a row
      // belongs to -- structurally unusable without guessing. player_to_score_N_or_more_
      // touchdowns' real threshold lives only in the market_key string (its `line` field is
      // always 0), unlike every other milestone market where `line` is already correct --
      // left unmapped rather than parsing a number out of a display string. player_both_
      // teams_to_score_*, player_to_have_most_*, player_highest_scoring_quarter, and
      // player_halftime/fulltime_* are team-level exotics/superlatives with no Market/Side
      // fit, same category of drop as SharpAPI's winning_margin or SportsGameOdds'
      // firstToScore/bothTeamsScored.
      return null;
  }
}

const PASSING_MARKETS = new Set([
  "player_passing_yards",
  "player_passing_touchdowns",
  "player_pass_attempts",
  "player_completions",
  "player_interceptions_thrown",
  "player_pass_rush_yards",
]);
const RECEIVING_MARKETS = new Set(["player_receiving_yards", "player_receptions", "player_longest_reception"]);
const RUSHING_MARKETS = new Set(["player_rushing_yards", "player_rush_rec_yards", "player_rushing_attempts"]);
const TD_SCORER_MARKETS = new Set(["player_anytime_touchdown", "first_touchdown_scorer", "last_touchdown_scorer"]);
const GAME_LINES_MARKETS = new Set(["moneyline", "point_spread", "total_points"]);

function categorizeMarketType(marketType: string): ResearchCategoryKey {
  if (GAME_LINES_MARKETS.has(marketType)) return "game_lines";
  if (TD_SCORER_MARKETS.has(marketType)) return "td_scorers";
  if (PASSING_MARKETS.has(marketType)) return "passing";
  if (RECEIVING_MARKETS.has(marketType)) return "receiving";
  if (RUSHING_MARKETS.has(marketType)) return "rushing";
  return "uncategorized";
}

// /odds' outcome.name identifies the side by echoing the real team name or "Over"/"Under" --
// confirmed real, the same convention the dormant lib/odds/ module already used for this
// exact vendor family (the-odds-api's own shape).
function sideFromOutcomeName(name: string, homeTeam: string, awayTeam: string): Side | null {
  if (name === homeTeam) return Side.HOME;
  if (name === awayTeam) return Side.AWAY;
  if (name === "Over") return Side.OVER;
  if (name === "Under") return Side.UNDER;
  return null;
}

function gameLinesSelections(odds: ParlayApiGameOdds): CategorizedSelection[] {
  const items: CategorizedSelection[] = [];
  for (const bookmaker of odds.bookmakers) {
    for (const market of bookmaker.markets) {
      const marketType = market.key === "h2h" ? "moneyline" : market.key === "spreads" ? "point_spread" : market.key === "totals" ? "total_points" : null;
      if (!marketType) continue;
      for (const outcome of market.outcomes) {
        const side = sideFromOutcomeName(outcome.name, odds.home_team, odds.away_team);
        if (!side) continue;
        const selection: ResearchSelection = {
          selectionId: `${odds.id}-${bookmaker.key}-${market.key}-${outcome.name}`,
          selection: outcome.name,
          line: outcome.point ?? null,
          priceAmerican: outcome.price,
          side,
          playerName: null,
          sportsbook: bookmaker.key,
          isMainLine: true,
          teamSide: null,
        };
        items.push({ selection, marketType, segment: null, categoryKey: "game_lines" });
      }
    }
  }
  return items;
}

function propSelections(props: ParlayApiProp[]): CategorizedSelection[] {
  const items: CategorizedSelection[] = [];
  for (const row of props) {
    const baseKey = normalizeMarketKey(row.market_key);
    const marketType = toMarketType(baseKey);
    if (!marketType) continue;
    const isMainLine = baseKey === row.market_key;
    const categoryKey = categorizeMarketType(marketType);

    if (TD_SCORER_MARKETS.has(marketType)) {
      // Single-outcome yes-only markets (Anytime/1st/Last TD Scorer) -- under_price is
      // always null for these, confirmed real, never a missing-data bug.
      if (row.over_price === null) continue;
      const selection: ResearchSelection = {
        selectionId: `${row.event_id}-${row.bookmaker}-${row.market_key}-${row.player}`,
        selection: "Yes",
        line: null,
        priceAmerican: row.over_price,
        side: Side.YES,
        playerName: row.player,
        sportsbook: row.bookmaker,
        isMainLine: true,
        teamSide: null,
      };
      items.push({ selection, marketType, segment: null, categoryKey });
      continue;
    }

    if (row.over_price !== null) {
      const selection: ResearchSelection = {
        selectionId: `${row.event_id}-${row.bookmaker}-${row.market_key}-${row.player}-over`,
        selection: "Over",
        line: row.line,
        priceAmerican: row.over_price,
        side: Side.OVER,
        playerName: row.player,
        sportsbook: row.bookmaker,
        isMainLine,
        teamSide: null,
      };
      items.push({ selection, marketType, segment: null, categoryKey });
    }
    if (row.under_price !== null) {
      const selection: ResearchSelection = {
        selectionId: `${row.event_id}-${row.bookmaker}-${row.market_key}-${row.player}-under`,
        selection: "Under",
        line: row.line,
        priceAmerican: row.under_price,
        side: Side.UNDER,
        playerName: row.player,
        sportsbook: row.bookmaker,
        isMainLine,
        teamSide: null,
      };
      items.push({ selection, marketType, segment: null, categoryKey });
    }
  }
  return items;
}

export function buildResearchGame(eventId: string, data: ParlayApiEventData | null): ResearchGame | null {
  if (!data) return null;
  const items: CategorizedSelection[] = [
    ...(data.odds ? gameLinesSelections(data.odds) : []),
    ...propSelections(data.props),
  ];
  return buildResearchGameFromSelections(
    { externalId: eventId, homeTeam: data.homeTeam, awayTeam: data.awayTeam, commenceTime: data.commenceTime },
    items,
  );
}

export function summarizeSchedule(events: ParlayApiEvent[]): ResearchGameSummary[] {
  return events
    .map((event) => ({
      externalId: event.id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
      source: "parlayapi" as const,
    }))
    .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
}
