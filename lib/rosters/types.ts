// athleteId is ESPN's own athlete id, carried through purely so lib/playerstats/ can look up
// a player's real game log (that endpoint is keyed by athlete id, and a prop selection only
// ever carries a player *name*). Empty string when a provider doesn't supply one -- callers
// treat that the same as "no game log available" rather than guessing.
// jersey is ESPN's own real `jersey` field (confirmed real, e.g. "38"), same empty-string
// convention -- purely cosmetic (app/research's PocketProps-style player header), never used
// for any matching/lookup.
export type RosterPlayer = { name: string; position: string; athleteId: string; jersey: string };

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
