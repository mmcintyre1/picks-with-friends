// Verbatim shapes of ParlayAPI's real responses, confirmed against real, live authenticated
// calls (base URL https://parlay-api.com/v1, auth via X-API-Key header) during this session's
// integration work -- not copied from vendor docs, whose published OpenAPI spec omits full
// response schemas. Only the fields this module actually reads are typed.

// GET /sports/{sport_key}/events -- free (0 credits), the cheap schedule-discovery call.
export type ParlayApiEvent = {
  id: string; // the real identifier accepted by both /odds' eventIds and /props' eventId
  canonical_event_id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

// GET /sports/{sport_key}/odds -- confirmed to mirror the-odds-api's own shape exactly
// (same nested bookmakers[].markets[].outcomes[] structure, same market keys h2h/spreads/
// totals) down to the field names, matching this project's already-existing (dormant since
// Phase 2.10) lib/odds/ module built for that vendor. Alt lines are NOT included here --
// confirmed real: this endpoint only ever returns the current main line, same limitation
// the-odds-api itself has.
export type ParlayApiOutcome = {
  name: string; // team name for h2h/spreads, "Over"/"Under" for totals
  price: number; // American, when oddsFormat=american is passed explicitly
  point?: number; // present on spreads/totals only
};

export type ParlayApiMarket = {
  key: string; // "h2h" | "spreads" | "totals" confirmed real
  last_update: string;
  outcomes: ParlayApiOutcome[];
};

export type ParlayApiBookmaker = {
  key: string; // "draftkings" | "fanduel" | "betmgm" | "caesars" (queried set -- others exist
  // on this vendor, e.g. "novig"/"fliff"/"sleeper", deliberately excluded since some are
  // exchanges/DFS-style fixed-payout apps rather than real sportsbooks with American odds)
  title: string;
  last_update: string;
  markets: ParlayApiMarket[];
};

export type ParlayApiGameOdds = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: ParlayApiBookmaker[];
};

// GET /sports/{sport_key}/props -- a flat row per (event, bookmaker, player-or-team, market)
// combination, real confirmed shape. Genuinely different structurally from /odds: no
// outcomes[] array, instead one row per selection with over_price/under_price directly.
// under_price is null for single-outcome markets (Anytime TD, milestone tiers, etc.) --
// confirmed real, never a missing-data bug.
//
// Confirmed real, important caveat: some market_keys under this endpoint carry a *fake*
// "player" field that's actually a team-matchup or generic label string (e.g.
// player_total_touchdowns' player field was "BUF Bills @ HOU Texans"; player_1st_half_moneyline's
// was literally "1st half moneyline") rather than a real athlete name, and provide no other
// field to disambiguate which team/side the row belongs to -- see categorize.ts's
// DROPPED_MARKET_KEYS for the full list of these left deliberately unmapped rather than
// guessed at.
export type ParlayApiInjury = {
  status: string;
  description: string | null;
  date: string;
  team: string | null;
};

export type ParlayApiProp = {
  event_id: string;
  canonical_event_id: string;
  sport_key: string;
  game_date: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmaker: string;
  bookmaker_title: string;
  player: string;
  market_key: string;
  market: string; // human-readable label, e.g. "Receiving Yards Milestones 100 Or More"
  line: number | null;
  over_price: number | null;
  under_price: number | null;
  implied_probability: number;
  is_dfs_flat_payout: boolean;
  dfs_normalized: boolean;
  last_update: string;
  injury?: ParlayApiInjury;
  age_seconds: number;
};

export type ParlayApiProviderErrorKind = "missing_key" | "rate_limited" | "upstream_error";

// Matches SharpApiProviderError/SportsGameOddsProviderError's exact shape so
// lib/research/actions.ts's fallback layer can treat any provider's failure identically.
export class ParlayApiProviderError extends Error {
  constructor(
    public kind: ParlayApiProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ParlayApiProviderError";
  }
}

// getNflEventOdds returns both real endpoints' data together (a single "full board" call
// from the caller's perspective, like every other provider's getNflEventOdds) -- odds and
// props are two separate real HTTP calls under the hood since ParlayAPI doesn't offer one
// combined endpoint, but categorize.ts folds them into one ResearchGame same as any other
// provider. Either half can be null/empty (no odds posted yet, or no props posted yet)
// without the other being affected.
export type ParlayApiEventData = {
  // Matchup identity -- read off whichever of odds/props actually had data, since both
  // carry it redundantly and a real per-event fetch might only have one populated this
  // early before kickoff.
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  odds: ParlayApiGameOdds | null;
  props: ParlayApiProp[];
};

export interface ParlayApiProvider {
  listNflSchedule(): Promise<ParlayApiEvent[]>;
  getNflEventOdds(eventId: string): Promise<ParlayApiEventData | null>;
}
