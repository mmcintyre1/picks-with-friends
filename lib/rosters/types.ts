export type RosterPlayer = { name: string; position: string };

export interface RosterProvider {
  getRoster(teamId: string): Promise<RosterPlayer[]>;
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
