// Real shapes for ESPN's free, no-key athlete game-log endpoint
// (site.web.api.espn.com/apis/common/v3/sports/{sportPath}/athletes/{athleteId}/gamelog),
// confirmed against real live responses for both a WR (receiving/rushing/fumbles categories)
// and a QB (passing/rushing categories) during this phase's implementation -- same free ESPN
// family lib/rosters/ and lib/evaluate/ already depend on, so no new vendor, key, or quota.
//
// The response's shape is positional: a flat top-level `names` array declares every stat
// column this athlete's log has (e.g. ["receptions","receivingTargets","receivingYards",...]),
// and each game's own `stats` array holds the values at the *same indexes*. Which columns
// exist depends on the athlete's position -- a QB log has passingYards, a WR log doesn't --
// so a stat that isn't in `names` simply isn't computable for that player (no hit rate
// shown), never a guess or a zero.

export type EspnGameLogEvent = {
  eventId: string;
  stats: string[]; // positionally aligned to the response's top-level `names`
};

export type EspnGameLogCategory = {
  events: EspnGameLogEvent[];
};

export type EspnGameLogSeasonType = {
  displayName: string;
  categories: EspnGameLogCategory[];
};

export type EspnGameLogEventMeta = {
  id: string;
  gameDate: string;
  atVs?: string; // "vs" (home) or "@" (away)
  score?: string;
  gameResult?: string; // "W" | "L"
  opponent?: { abbreviation?: string; displayName?: string };
};

export type EspnGameLogResponse = {
  names: string[];
  labels: string[];
  events: Record<string, EspnGameLogEventMeta>;
  seasonTypes: EspnGameLogSeasonType[];
};

// One real past game, already reduced to just the stat this prop cares about.
export type GameLogEntry = {
  eventId: string;
  date: string; // ISO
  opponent: string; // abbreviation, e.g. "SEA"
  isHome: boolean;
  value: number;
};

// One player's real history for one canonical propType, newest game first.
export type PlayerPropLog = {
  propType: string;
  entries: GameLogEntry[];
};

export type PlayerLogs = {
  playerName: string;
  athleteId: string;
  logs: PlayerPropLog[];
};

export type PlayerStatsProviderErrorKind = "not_found" | "upstream_error";

export class PlayerStatsProviderError extends Error {
  constructor(
    public kind: PlayerStatsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PlayerStatsProviderError";
  }
}

export interface PlayerStatsProvider {
  // sportPath is the ESPN site-API sport segment, e.g. "football/nfl" -- same convention
  // lib/rosters/leagues.ts's LEAGUE_ESPN_PATHS already established.
  getGameLog(sportPath: string, athleteId: string): Promise<EspnGameLogResponse>;
}
