// Verbatim shape of SportsGameOdds' /v2/events/ response, confirmed against real, live
// authenticated calls during Phase 2.19 planning (base URL https://api.sportsgameodds.com/v2/,
// auth via X-Api-Key header) -- not copied from vendor docs, which don't show full response
// shapes. Only the fields this module actually reads are typed.

export type SportsGameOddsAltLine = {
  odds: string; // American odds as a signed string, e.g. "-113", "+125"
  overUnder?: string; // numeric line as a string, present on ou-shaped odds only
  available: boolean; // false means historically offered, not currently live -- must filter
  lastUpdatedAt: string;
};

export type SportsGameOddsBookmakerEntry = {
  odds: string;
  overUnder?: string;
  available: boolean;
  lastUpdatedAt: string;
  deeplink?: string;
  // Confirmed real: every alternate line for this book+market lives here, never mixed into
  // the top-level entry -- the top-level odds/overUnder above is always the current main
  // line, unlike SharpAPI's flat-rows-plus-is_main_line-flag shape.
  altLines?: SportsGameOddsAltLine[];
};

// One entry in an event's `odds` object, keyed by a self-describing oddID
// (`{statID}-{playerID or side}-{periodID}-{betTypeID}-{sideID}`, e.g.
// "passing_yards-DRAKE_MAYE_1_NFL-game-ou-over"). periodID/betTypeID/sideID are real,
// confirmed enums (see categorize.ts's mapping tables) -- confirmed values only, anything
// else routes to uncategorized rather than being guessed at.
export type SportsGameOddsOdd = {
  oddID: string;
  marketName: string;
  statID: string; // e.g. "passing_yards", "points", "touchdowns", "firstTouchdown"
  statEntityID: string; // playerID for player props, "home"/"away" for team-level odds
  periodID: string; // "game" | "1q" | "2q" | "3q" | "4q" confirmed real; others unconfirmed
  betTypeID: string; // "ou" | "ml" | "sp" | "yn" confirmed real
  sideID: string; // "over" | "under" | "home" | "away" | "yes" confirmed real
  playerID?: string; // present on player-prop odds only
  byBookmaker: Record<string, SportsGameOddsBookmakerEntry>;
};

export type SportsGameOddsTeam = {
  teamID: string;
  names: { long: string; medium: string; short: string };
};

export type SportsGameOddsPlayer = {
  playerID: string;
  name: string;
};

export type SportsGameOddsEvent = {
  eventID: string;
  sportID: string;
  leagueID: string;
  teams: { home: SportsGameOddsTeam; away: SportsGameOddsTeam };
  status: { startsAt: string; oddsAvailable?: boolean; oddsPresent?: boolean };
  players?: Record<string, SportsGameOddsPlayer>;
  odds: Record<string, SportsGameOddsOdd>;
};

export type SportsGameOddsResponse = {
  success: boolean;
  data: SportsGameOddsEvent[];
};

export type SportsGameOddsProviderErrorKind = "missing_key" | "rate_limited" | "upstream_error";

// Matches SharpApiProviderError's exact shape so lib/research/actions.ts's fallback layer
// can treat either vendor's failure the same way without a vendor-specific switch.
export class SportsGameOddsProviderError extends Error {
  constructor(
    public kind: SportsGameOddsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SportsGameOddsProviderError";
  }
}

export interface SportsGameOddsProvider {
  listNflSchedule(): Promise<SportsGameOddsEvent[]>;
  getNflEventOdds(eventId: string): Promise<SportsGameOddsEvent | null>;
}
