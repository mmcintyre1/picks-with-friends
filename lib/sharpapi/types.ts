// Verbatim shape of one row from SharpAPI's /odds response, confirmed against real,
// live-fetched NFL data during Phase 2.14 planning/implementation (see the plan file's
// "Verified this session" section) -- not a shape copied from vendor docs. Only the fields
// this module actually reads are typed; the vendor sends more (deep_link, market_id,
// selection_id, is_alternate_line, etc.) that we don't need.
export type SharpApiRow = {
  id: string;
  sportsbook: string;
  event_id: string;
  home_team: string;
  away_team: string;
  market_type: string; // e.g. "moneyline", "1st_half_point_spread", "player_receiving_yards"
  selection: string; // display text -- a team name, "Over"/"Under", or (futures) a person's name
  selection_type: string; // "home" | "away" | "over" | "under" | "outright" | "other" | ...
  team_side?: "home" | "away";
  market_segment?: string; // e.g. "1st_half", "1st_quarter" -- absent for full-game markets
  odds_american: number;
  line: number | null;
  event_start_time: string; // ISO
  is_player_prop: boolean;
  player_name?: string; // present on confirmed player-prop rows
  stat_category?: string; // e.g. "passing_tds" -- present on confirmed player-prop rows
  // A market like point_spread/total_points/team_total can carry many rows for the same
  // side (alternate lines) -- confirmed real: a real game had 406 total rows for markets
  // that only have ~30 truly distinct (market, side) combinations. is_main_line marks which
  // one SharpAPI itself considers the primary line for that side; missing on older/mock
  // rows defaults to true (harmless when there's genuinely only one line anyway).
  is_main_line?: boolean;
};

export type SharpApiResponse = {
  data: SharpApiRow[];
  pagination: { limit: number; offset: number; count: number; has_more: boolean; next_offset: number };
  meta: { tier: { data_delay_seconds: number; requests_per_minute: number } };
};

export type SharpApiProviderErrorKind = "missing_key" | "rate_limited" | "upstream_error";

export class SharpApiProviderError extends Error {
  constructor(
    public kind: SharpApiProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SharpApiProviderError";
  }
}

export interface SharpApiProvider {
  // Cheap schedule discovery -- real fetches during implementation showed the broad
  // /odds?league=nfl endpoint (no filter) dominated by season-long futures/novelty markets
  // (over a thousand of them), and the bare /events list is no better (same problem, worse
  // volume). Filtering to market=moneyline instead reliably returns exactly the real
  // two-team games with a line posted, confirmed against live data.
  listNflSchedule(): Promise<SharpApiRow[]>;
  // Full odds+props for one specific game, confirmed via a real event_id-filtered call --
  // scoped to just that event, no futures noise to page past.
  getNflEventOdds(eventId: string): Promise<SharpApiRow[]>;
}
