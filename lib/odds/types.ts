// Shapes mirror The Odds API's JSON closely (not flattened) so the browsing UI can slice
// by bookmaker/market client-side the same way DraftKings' own filter panel would.

export type ProviderOutcome = {
  name: string; // team name for h2h/spreads; "Over"/"Under" for totals & O/U props; "Yes"/"No" for YESNO props
  price: number; // American odds, e.g. -110, +150
  point?: number; // spread/total/prop line; absent for h2h and YESNO props
  description?: string; // player name -- present only on player-prop outcomes
};

export type ProviderMarket = {
  key: string; // "h2h" | "spreads" | "totals" | "player_pass_yds" | "player_anytime_td" | ...
  lastUpdate: string; // ISO timestamp
  outcomes: ProviderOutcome[];
};

export type ProviderBookmaker = {
  key: string; // "draftkings", "fanduel", "betmgm", "caesars", ...
  title: string;
  lastUpdate: string;
  markets: ProviderMarket[];
};

export type ProviderGame = {
  id: string; // provider event id -- becomes Game.externalId when a pick is made from it
  sportKey: string;
  sportTitle: string;
  commenceTime: string; // ISO
  homeTeam: string;
  awayTeam: string;
  bookmakers: ProviderBookmaker[];
};

// Per-event /events/{id}/odds response. Structurally identical to ProviderGame (same
// shape, just scoped to one event and to the requested prop markets) -- kept as a
// distinct name since it's a different, per-event cost tier, not the same call.
export type ProviderProp = ProviderGame;

// Phase 3 (auto-grading) shape -- kept on the interface now for stability, not
// implemented by any provider until that phase.
export type ProviderScore = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
};

export interface OddsProvider {
  listGamesWithOdds(
    sportKey: string,
    opts?: { commenceFrom?: Date; commenceTo?: Date },
  ): Promise<ProviderGame[]>;

  listPlayerProps(
    sportKey: string,
    eventId: string,
    opts?: { markets?: string[] },
  ): Promise<ProviderProp>;

  getScores(sportKey: string, opts: { daysFrom: number }): Promise<ProviderScore[]>;
}

export type OddsProviderErrorKind = "missing_key" | "quota_exceeded" | "not_found" | "upstream_error";

export class OddsProviderError extends Error {
  constructor(
    public kind: OddsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "OddsProviderError";
  }
}
