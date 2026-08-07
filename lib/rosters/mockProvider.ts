import type { RosterPlayer, RosterProvider } from "./types";

// Small inline fixtures (unlike lib/odds/mockProvider.ts's JSON files, which mirror a
// complex nested vendor shape) -- a roster here is just a flat name+position list, no
// need for a separate file to keep this readable.
const ROSTERS: Record<string, RosterPlayer[]> = {
  "12": [
    { name: "Patrick Mahomes", position: "QB" },
    { name: "Travis Kelce", position: "TE" },
    { name: "Isiah Pacheco", position: "RB" },
    { name: "Xavier Worthy", position: "WR" },
  ],
  "7": [
    { name: "Bo Nix", position: "QB" },
    { name: "Courtland Sutton", position: "WR" },
    { name: "Javonte Williams", position: "RB" },
  ],
};

// Deterministic, offline implementation for development/testing -- mirrors
// lib/odds/mockProvider.ts's role for the odds layer.
export function createMockRosterProvider(): RosterProvider {
  return {
    async getRoster(teamId: string): Promise<RosterPlayer[]> {
      return ROSTERS[teamId] ?? [];
    },
  };
}
