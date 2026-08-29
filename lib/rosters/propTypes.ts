// Position-gated prop-type suggestions -- broadly "anything DraftKings offers for that
// position," not just the handful of markets lib/odds/mapping.ts's live-provider
// integration knows how to map. This is a pure typing aid for the free-text propType
// field, so being generous here costs nothing and saves a lot of manual typing. Keyed by
// league first since position abbreviations collide across sports (NBA "C" = Center,
// MLB "C" = Catcher, NHL "C" = Center -- all different stat sets).
const NFL_PROP_TYPES: Record<string, string[]> = {
  QB: [
    "Passing Yards",
    "Passing TDs",
    "Completions",
    "Pass Attempts",
    "Interceptions Thrown",
    "Longest Completion",
    "Rushing Yards",
    "Rushing Attempts",
    "Anytime TD",
  ],
  RB: [
    "Rushing Yards",
    "Rushing Attempts",
    "Longest Rush",
    "Receptions",
    "Receiving Yards",
    "Rush + Rec Yards",
    "Anytime TD",
  ],
  FB: ["Rushing Yards", "Receptions", "Receiving Yards", "Anytime TD"],
  WR: ["Receptions", "Receiving Yards", "Longest Reception", "Rush + Rec Yards", "Anytime TD"],
  TE: ["Receptions", "Receiving Yards", "Longest Reception", "Anytime TD"],
  K: ["Kicking Points", "Field Goals Made", "Longest Field Goal", "Extra Points Made"],
  DE: ["Sacks", "Total Tackles", "Tackles For Loss", "QB Hits"],
  DT: ["Sacks", "Total Tackles", "Tackles For Loss", "QB Hits"],
  OLB: ["Sacks", "Total Tackles", "Tackles For Loss", "Interceptions"],
  ILB: ["Total Tackles", "Sacks", "Interceptions", "Passes Defended"],
  LB: ["Total Tackles", "Sacks", "Interceptions", "Passes Defended"],
  CB: ["Interceptions", "Passes Defended", "Total Tackles"],
  S: ["Interceptions", "Passes Defended", "Total Tackles"],
  FS: ["Interceptions", "Passes Defended", "Total Tackles"],
  SS: ["Interceptions", "Passes Defended", "Total Tackles"],
};

// NBA's roster endpoint only exposes coarse Guard/Forward/Center splits (no PG/SG/SF/PF).
const NBA_PROP_TYPES: Record<string, string[]> = {
  G: ["Points", "Assists", "Three-Pointers Made", "Steals", "Points + Assists", "Pts + Reb + Ast"],
  F: ["Points", "Rebounds", "Three-Pointers Made", "Blocks", "Pts + Reb + Ast"],
  C: ["Points", "Rebounds", "Blocks", "Double-Double", "Points + Rebounds"],
};

// SP/RP are the leaf pitcher positions ESPN returns; "P" covers the rare case a roster
// only reports the parent "Pitcher" category.
const MLB_PROP_TYPES: Record<string, string[]> = {
  SP: ["Strikeouts", "Earned Runs Allowed", "Hits Allowed", "Walks Allowed", "Outs Recorded"],
  RP: ["Strikeouts", "Earned Runs Allowed", "Hits Allowed", "Walks Allowed", "Outs Recorded"],
  P: ["Strikeouts", "Earned Runs Allowed", "Hits Allowed", "Walks Allowed", "Outs Recorded"],
  C: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Hits + Runs + RBIs"],
  "1B": ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Hits + Runs + RBIs"],
  "2B": ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Stolen Bases", "Hits + Runs + RBIs"],
  "3B": ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Hits + Runs + RBIs"],
  SS: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Stolen Bases", "Hits + Runs + RBIs"],
  OF: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Stolen Bases", "Hits + Runs + RBIs"],
  LF: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Stolen Bases", "Hits + Runs + RBIs"],
  CF: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Stolen Bases", "Hits + Runs + RBIs"],
  RF: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Stolen Bases", "Hits + Runs + RBIs"],
  DH: ["Hits", "Home Runs", "RBIs", "Total Bases", "Runs Scored", "Hits + Runs + RBIs"],
};

const NHL_PROP_TYPES: Record<string, string[]> = {
  C: ["Goals", "Assists", "Points", "Shots on Goal"],
  LW: ["Goals", "Assists", "Points", "Shots on Goal"],
  RW: ["Goals", "Assists", "Points", "Shots on Goal"],
  D: ["Goals", "Assists", "Points", "Shots on Goal", "Blocked Shots"],
  G: ["Saves", "Goals Against"],
};

const PROP_TYPES_BY_LEAGUE: Record<string, Record<string, string[]>> = {
  NFL: NFL_PROP_TYPES,
  NBA: NBA_PROP_TYPES,
  MLB: MLB_PROP_TYPES,
  NHL: NHL_PROP_TYPES,
};

// Used once a player's position is known but isn't one of that league's mapped positions
// above (NFL offensive line, an MLB two-way player's other position, etc.) -- these
// rarely get individual props, so keep it minimal rather than suggesting nonsense.
const UNMAPPED_POSITION_PROP_TYPES = ["Anytime TD"];

// Used before a player has been picked/matched at all (e.g. manual entry without
// loading a roster, or a league with no roster support) -- a broad, sport-agnostic
// starting point that still leans NFL since that's the primary use case.
export const GENERIC_PROP_TYPES = [
  "Passing Yards",
  "Rushing Yards",
  "Receiving Yards",
  "Receptions",
  "Anytime TD",
];

export function propTypesForPosition(league: string, position: string | undefined): string[] {
  if (!position) return GENERIC_PROP_TYPES;
  return PROP_TYPES_BY_LEAGUE[league]?.[position] ?? UNMAPPED_POSITION_PROP_TYPES;
}

// True only for positions with a real, specific mapped list -- used to filter the
// player-prop picker's roster list down to players actually worth showing (skips
// offensive linemen etc., which would otherwise only ever offer the generic fallback).
export function hasMappedPropTypes(league: string, position: string): boolean {
  return Boolean(PROP_TYPES_BY_LEAGUE[league]?.[position]);
}

// No real popularity/stats signal to sort by, so this leans on something we do have: each
// league's map above already declares its positions in a sensible display order (NFL's
// offensive skill positions -- QB/RB/FB/WR/TE -- come before defense). Reused to sort the
// player-prop picker's roster list so offense shows up before defense, etc., without
// needing new data. Unmapped positions (already filtered out by hasMappedPropTypes before
// this runs) sort last if they ever show up here anyway.
export function positionSortRank(league: string, position: string): number {
  const positions = PROP_TYPES_BY_LEAGUE[league];
  if (!positions) return 0;
  const keys = Object.keys(positions);
  const index = keys.indexOf(position);
  return index === -1 ? keys.length : index;
}
