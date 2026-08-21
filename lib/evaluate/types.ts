export type BoxScoreStatus = { state: "pre" | "in" | "post"; completed: boolean; detail: string };

// Flattened at fetch time so nothing downstream deals with ESPN's parallel labels[]/stats[]
// arrays, or its inconsistent stat-group-name field (NFL uses `name`, MLB uses `type`),
// directly. Keyed by "{statGroup}.{statKey}" using ESPN's own stable `keys` array entries
// (e.g. "passing.passingYards"), not its free-text display labels -- labels are cosmetic
// and more likely to drift, keys read like a real API contract.
export type BoxScore = {
  status: BoxScoreStatus;
  homeScore: number | null;
  awayScore: number | null;
  // lowercased athlete display name -> "{statGroup}.{statKey}" -> raw string value
  // (some values are compound, e.g. "15/24" for completions/attempts -- see
  // lib/evaluate/statLabels.ts's `extract` field for how those get split).
  playerStats: Map<string, Map<string, string>>;
};

export interface BoxScoreProvider {
  // sportPath is the ESPN site-API sport segment (e.g. "football/nfl"); eventId is ESPN's
  // own event id (Game.espnEventId -- never the ambiguous Game.externalId).
  getBoxScore(sportPath: string, eventId: string): Promise<BoxScore>;
}

export type BoxScoreProviderErrorKind = "not_found" | "upstream_error";

export class BoxScoreProviderError extends Error {
  constructor(
    public kind: BoxScoreProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "BoxScoreProviderError";
  }
}
