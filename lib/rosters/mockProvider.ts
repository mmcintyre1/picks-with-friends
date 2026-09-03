import type { RosterPlayer, RosterProvider } from "./types";

// Small inline fixtures (unlike lib/odds/mockProvider.ts's JSON files, which mirror a
// complex nested vendor shape) -- a roster here is just a flat name+position list, no
// need for a separate file to keep this readable. Keyed by "sportPath:teamId" since team
// ids collide across leagues (e.g. NFL team "12" and NBA team "12" are unrelated teams).
const ROSTERS: Record<string, RosterPlayer[]> = {
  "football/nfl:12": [
    { name: "Patrick Mahomes", position: "QB", athleteId: "3139477" },
    { name: "Travis Kelce", position: "TE", athleteId: "15847" },
    { name: "Isiah Pacheco", position: "RB", athleteId: "4361529" },
    { name: "Xavier Worthy", position: "WR", athleteId: "4432773" },
  ],
  "football/nfl:7": [
    { name: "Bo Nix", position: "QB", athleteId: "4426338" },
    { name: "Courtland Sutton", position: "WR", athleteId: "3128429" },
    { name: "Javonte Williams", position: "RB", athleteId: "4241457" },
  ],
  "basketball/nba:2": [
    { name: "Jayson Tatum", position: "F", athleteId: "4065648" },
    { name: "Jaylen Brown", position: "F", athleteId: "3917376" },
    { name: "Derrick White", position: "G", athleteId: "3078576" },
  ],
  "baseball/mlb:15": [
    { name: "Spencer Strider", position: "SP", athleteId: "41287" },
    { name: "Ronald Acuna Jr.", position: "OF", athleteId: "36185" },
  ],
  "hockey/nhl:1": [
    { name: "David Pastrnak", position: "RW", athleteId: "3114772" },
    { name: "Jeremy Swayman", position: "G", athleteId: "4233855" },
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
