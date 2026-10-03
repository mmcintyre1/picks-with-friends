import type { ResearchProviderSource } from "./types";

// Lives outside actions.ts (a "use server" file can only export async functions) so the APIs
// status page can show the exact same precedence the research layer actually uses.
// ParlayAPI first -- confirmed via a real, apples-to-apples pull against the exact same live
// game (Patriots @ Seahawks) to carry meaningfully broader real coverage than either existing
// provider: 386 real DK/FD-priced selections for this one event alone (vs. SharpAPI's ~400
// rows across its whole catalog for the same game, and SportsGameOdds' narrower per-statID
// coverage before its own real fix), including real milestone-ladder tiers neither other
// vendor exposes. This is now the basis for federation (below), not just a fallback order --
// ParlayAPI's own real game/team identity is what every other provider gets matched against.
export const PROVIDER_ORDER: ResearchProviderSource[] = ["parlayapi", "sportsgameodds", "sharpapi"];
