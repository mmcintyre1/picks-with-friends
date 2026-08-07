// Position-gated prop-type suggestions -- broadly "anything DraftKings offers for that
// position," not just the handful of markets lib/odds/mapping.ts's live-provider
// integration knows how to map. This is a pure typing aid for the free-text propType
// field, so being generous here costs nothing and saves a lot of manual typing.
export const PROP_TYPES_BY_POSITION: Record<string, string[]> = {
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

// Used once a player's position is known but isn't one of the mapped skill/defensive
// positions above (offensive line, long snapper, punter, etc.) -- these rarely get
// individual props, so keep it minimal rather than suggesting nonsense.
const UNMAPPED_POSITION_PROP_TYPES = ["Anytime TD"];

// Used before a player has been picked/matched at all (e.g. manual entry without
// loading a roster) -- a broad, position-agnostic starting point.
export const GENERIC_PROP_TYPES = [
  "Passing Yards",
  "Rushing Yards",
  "Receiving Yards",
  "Receptions",
  "Anytime TD",
];

export function propTypesForPosition(position: string | undefined): string[] {
  if (!position) return GENERIC_PROP_TYPES;
  return PROP_TYPES_BY_POSITION[position] ?? UNMAPPED_POSITION_PROP_TYPES;
}
