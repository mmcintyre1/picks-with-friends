import { Side } from "@/app/generated/prisma/enums";
import type { CategorizedSelection } from "@/lib/research/marketUtils";
import { buildResearchGameFromSelections } from "@/lib/research/marketUtils";
import type { ResearchCategoryKey, ResearchGame, ResearchGameSummary, ResearchSelection } from "@/lib/research/types";

import type { SportsGameOddsEvent, SportsGameOddsOdd } from "./types";

// periodID -> the same segment strings SharpAPI's own stripSegmentPrefix produces, so
// ResearchGameDetail.tsx's Halves/Quarters grouping works unchanged regardless of which
// provider supplied the data. Confirmed real for this vendor: "game", "1q"-"4q". Halves
// ("1h"/"2h") were not observed in this session's real pull -- rather than guess, any
// periodID not in this table is kept as its own (never-shown) segment bucket instead of
// silently defaulting to null, so an unconfirmed segment can never get merged into the
// full-game view.
const PERIOD_TO_SEGMENT: Record<string, string> = {
  "1q": "1st_quarter",
  "2q": "2nd_quarter",
  "3q": "3rd_quarter",
  "4q": "4th_quarter",
  "1h": "1st_half",
  "2h": "2nd_half",
};

function periodToSegment(periodID: string): string | null {
  if (periodID === "game") return null;
  return PERIOD_TO_SEGMENT[periodID] ?? periodID;
}

// statID + betTypeID -> the same canonical marketType strings lib/research/marketUtils.ts's
// PROP_TYPE_LABELS and every Research* UI component already key off (mostly SharpAPI's own
// established vocabulary, extended with two new confirmed-real markets SharpAPI never had:
// player_rush_rec_yards and player_anytime_touchdown). Distinct betTypeIDs on the same
// statID (touchdowns: ou vs yn; passing_touchdowns: ou vs yn) deliberately get DIFFERENT
// marketType strings -- ResearchPropTable.tsx groups by marketType and branches its whole
// ladder/O-U-table vs single-outcome rendering on whether a group's selections are
// Over/Under-shaped, so merging an O/U market and a Yes/No market under one marketType would
// silently drop the Yes/No selections (neither branch would find them).
// Expanded against a real, full-board live pull of the same Patriots @ Seahawks event
// (Phase 2.19 follow-up) that surfaced 27 distinct statIDs -- more than double what the
// original narrower pull had confirmed. Anything below with no clean Market/Side fit or no
// real player/team attachment (firstToScore, bothTeamsScored -- team-level exotics with no
// matching Market enum value; fantasyScore -- a DFS-style aggregate, not a real DK player
// prop shape) is deliberately left unmapped (returns null, silently dropped) rather than
// forced into a category it doesn't belong in -- same discipline every other unmapped shape
// in this project follows.
function toMarketType(statID: string, betTypeID: string): string | null {
  if (statID === "points") {
    if (betTypeID === "ml") return "moneyline";
    if (betTypeID === "sp") return "point_spread";
    if (betTypeID === "ou") return "total_points";
    return null;
  }
  if (statID === "passing_yards") return "player_passing_yards";
  if (statID === "passing_touchdowns") return betTypeID === "yn" ? "player_passing_touchdowns_anytime" : "player_passing_touchdowns";
  if (statID === "passing_attempts") return "player_pass_attempts";
  if (statID === "passing_completions") return "player_completions";
  if (statID === "passing_interceptions") return "player_interceptions_thrown";
  if (statID === "passing_longestCompletion") return "player_longest_completion";
  if (statID === "passing+rushing_yards") return "player_pass_rush_yards";
  if (statID === "receiving_yards") return "player_receiving_yards";
  if (statID === "receiving_receptions") return "player_receptions";
  if (statID === "receiving_longestReception") return "player_longest_reception";
  if (statID === "rushing_yards") return "player_rushing_yards";
  if (statID === "rushing_attempts") return "player_rushing_attempts";
  if (statID === "rushing_longestRush") return "player_longest_rush";
  if (statID === "rushing+receiving_yards") return "player_rush_rec_yards";
  if (statID === "touchdowns") return betTypeID === "yn" ? "player_anytime_touchdown" : "player_touchdowns";
  if (statID === "firstTouchdown") return "first_touchdown_scorer";
  if (statID === "lastTouchdown") return "last_touchdown_scorer";
  if (statID === "kicking_totalPoints") return "player_kicking_points";
  if (statID === "fieldGoals_made") return "player_field_goals_made";
  if (statID === "extraPoints_kicksMade") return "player_extra_points_made";
  // "defense_interceptions" is deliberately NOT mapped -- a real live pull found it
  // attached to the same QB playerIDs as passing_interceptions (not to a real defensive
  // player), so its actual meaning is ambiguous (a duplicate of the QB's own turnover
  // count? something else?) rather than confidently "this specific defender's picks."
  // Left unmapped/dropped rather than guessed, same discipline as every other unconfirmed
  // shape in this module.
  if (statID === "defense_combinedTackles") return "player_total_tackles";
  if (statID === "defense_soloTackles") return "player_solo_tackles";
  if (statID === "defense_assistedTackles") return "player_assisted_tackles";
  return null;
}

const PASSING_MARKETS = new Set([
  "player_passing_yards",
  "player_passing_touchdowns",
  "player_passing_touchdowns_anytime",
  "player_pass_attempts",
  "player_completions",
  "player_interceptions_thrown",
  "player_longest_completion",
  "player_pass_rush_yards",
]);
const RECEIVING_MARKETS = new Set(["player_receiving_yards", "player_receptions", "player_longest_reception"]);
const RUSHING_MARKETS = new Set(["player_rushing_yards", "player_rush_rec_yards", "player_rushing_attempts", "player_longest_rush"]);
const TD_SCORER_MARKETS = new Set(["player_touchdowns", "player_anytime_touchdown", "first_touchdown_scorer", "last_touchdown_scorer"]);
const GAME_LINES_MARKETS = new Set(["moneyline", "point_spread", "total_points", "team_total"]);
const KICKING_MARKETS = new Set(["player_kicking_points", "player_field_goals_made", "player_extra_points_made"]);
const DEFENSE_MARKETS = new Set(["player_total_tackles", "player_solo_tackles", "player_assisted_tackles"]);

function categorizeMarketType(marketType: string): ResearchCategoryKey {
  if (GAME_LINES_MARKETS.has(marketType)) return "game_lines";
  if (TD_SCORER_MARKETS.has(marketType)) return "td_scorers";
  if (PASSING_MARKETS.has(marketType)) return "passing";
  if (RECEIVING_MARKETS.has(marketType)) return "receiving";
  if (RUSHING_MARKETS.has(marketType)) return "rushing";
  if (KICKING_MARKETS.has(marketType)) return "kicking";
  if (DEFENSE_MARKETS.has(marketType)) return "defense";
  return "uncategorized";
}

// betTypeID + sideID -> Side. Confirmed real combinations only: ou/over, ou/under,
// ml/away, ml/home, sp/away, sp/home, yn/yes. Anything else is unconfirmed and returns
// null rather than a guess (the selection is simply dropped, matching every other
// provider's same discipline for an unrecognized shape).
function toSide(betTypeID: string, sideID: string): Side | null {
  if (betTypeID === "ou") return sideID === "over" ? Side.OVER : sideID === "under" ? Side.UNDER : null;
  if (betTypeID === "ml" || betTypeID === "sp") return sideID === "away" ? Side.AWAY : sideID === "home" ? Side.HOME : null;
  if (betTypeID === "yn") return sideID === "yes" ? Side.YES : null;
  return null;
}

function parseAmerican(odds: string | undefined): number | null {
  if (!odds) return null;
  const n = Number(odds);
  return Number.isNaN(n) ? null : n;
}

function parseLine(overUnder: string | undefined): number | null {
  if (overUnder === undefined) return null;
  const n = Number(overUnder);
  return Number.isNaN(n) ? null : n;
}

// Builds one CategorizedSelection per (odd, bookmaker, main-or-alt-line) combination --
// SportsGameOdds nests every alt line inside byBookmaker[book].altLines[] rather than
// SharpAPI's flat-rows-plus-is_main_line-flag shape, so the "is this the main line" split
// is structural here (the top-level entry vs. an altLines[] entry) instead of a flag read.
function selectionsForOdd(
  odd: SportsGameOddsOdd,
  marketType: string,
  playerName: string | null,
): ResearchSelection[] {
  const side = toSide(odd.betTypeID, odd.sideID);
  if (!side) return [];

  const results: ResearchSelection[] = [];
  for (const [sportsbook, entry] of Object.entries(odd.byBookmaker)) {
    if (entry.available) {
      const price = parseAmerican(entry.odds);
      if (price !== null) {
        results.push({
          selectionId: odd.oddID,
          selection: odd.betTypeID === "yn" ? "Yes" : side === Side.OVER ? "Over" : side === Side.UNDER ? "Under" : odd.marketName,
          line: parseLine(entry.overUnder),
          priceAmerican: price,
          side,
          playerName,
          sportsbook,
          isMainLine: true,
          teamSide: null,
        });
      }
    }
    for (const [i, alt] of (entry.altLines ?? []).entries()) {
      if (!alt.available) continue;
      const price = parseAmerican(alt.odds);
      if (price === null) continue;
      results.push({
        selectionId: `${odd.oddID}-alt-${sportsbook}-${i}`,
        selection: side === Side.OVER ? "Over" : side === Side.UNDER ? "Under" : odd.marketName,
        line: parseLine(alt.overUnder),
        priceAmerican: price,
        side,
        playerName,
        sportsbook,
        isMainLine: false,
        teamSide: null,
      });
    }
  }
  return results;
}

// Builds the full categorized ResearchGame for one real event -- team_total is not yet
// confirmed real for this vendor (not observed in this session's game-level sample), so it
// deliberately never appears here rather than being guessed at; add it once a real pull
// confirms the statID/shape, same discipline used for every other market in this module.
export function buildResearchGame(event: SportsGameOddsEvent): ResearchGame | null {
  const items: CategorizedSelection[] = [];
  for (const odd of Object.values(event.odds)) {
    const marketType = toMarketType(odd.statID, odd.betTypeID);
    if (!marketType) continue;
    const playerName = odd.playerID ? (event.players?.[odd.playerID]?.name ?? null) : null;
    const segment = periodToSegment(odd.periodID);
    const categoryKey = categorizeMarketType(marketType);
    for (const selection of selectionsForOdd(odd, marketType, playerName)) {
      items.push({ selection, marketType, segment, categoryKey });
    }
  }

  return buildResearchGameFromSelections(
    {
      externalId: event.eventID,
      homeTeam: event.teams.home.names.long,
      awayTeam: event.teams.away.names.long,
      commenceTime: event.status.startsAt,
    },
    items,
  );
}

export function summarizeSchedule(events: SportsGameOddsEvent[]): ResearchGameSummary[] {
  return events
    .map((event) => ({
      externalId: event.eventID,
      homeTeam: event.teams.home.names.long,
      awayTeam: event.teams.away.names.long,
      commenceTime: event.status.startsAt,
      source: "sportsgameodds" as const,
    }))
    .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
}
