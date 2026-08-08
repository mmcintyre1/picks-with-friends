import type { RosterPlayer, RosterProvider } from "./types";

// Small inline fixtures (unlike lib/odds/mockProvider.ts's JSON files, which mirror a
// complex nested vendor shape) -- a roster here is just a flat name+position list, no
// need for a separate file to keep this readable. Keyed by "sportPath:teamId" since team
// ids collide across leagues (e.g. NFL team "12" and NBA team "12" are unrelated teams).
const ROSTERS: Record<string, RosterPlayer[]> = {
  "football/nfl:12": [
    { name: "Patrick Mahomes", position: "QB" },
    { name: "Travis Kelce", position: "TE" },
    { name: "Isiah Pacheco", position: "RB" },
    { name: "Xavier Worthy", position: "WR" },
  ],
  "football/nfl:7": [
    { name: "Bo Nix", position: "QB" },
    { name: "Courtland Sutton", position: "WR" },
    { name: "Javonte Williams", position: "RB" },
  ],
  "basketball/nba:2": [
    { name: "Jayson Tatum", position: "F" },
    { name: "Jaylen Brown", position: "F" },
    { name: "Derrick White", position: "G" },
  ],
  "baseball/mlb:15": [
    { name: "Spencer Strider", position: "SP" },
    { name: "Ronald Acuna Jr.", position: "OF" },
  ],
  "hockey/nhl:1": [
    { name: "David Pastrnak", position: "RW" },
    { name: "Jeremy Swayman", position: "G" },
  ],
};

// Deterministic, offline implementation for development/testing -- mirrors
// lib/odds/mockProvider.ts's role for the odds layer.
export function createMockRosterProvider(): RosterProvider {
  return {
    async getRoster(sportPath: string, teamId: string): Promise<RosterPlayer[]> {
      return ROSTERS[`${sportPath}:${teamId}`] ?? [];
    },
  };
}
