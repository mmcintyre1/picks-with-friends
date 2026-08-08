export type RosterPlayer = { name: string; position: string };

export interface RosterProvider {
  // sportPath is the ESPN site-API sport segment, e.g. "football/nfl" -- see
  // lib/rosters/leagues.ts's LEAGUE_ESPN_PATHS. The mock provider ignores it.
  getRoster(sportPath: string, teamId: string): Promise<RosterPlayer[]>;
}

export type RosterProviderErrorKind = "not_found" | "upstream_error";

export class RosterProviderError extends Error {
  constructor(
    public kind: RosterProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "RosterProviderError";
  }
}
