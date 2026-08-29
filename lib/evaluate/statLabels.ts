// Maps the canonical propType strings suggested in lib/rosters/propTypes.ts to the
// ESPN box-score stat(s) that determine them, built from REAL fetched box scores (NFL:
// event 401873286, MLB: event 401816617) during implementation -- not guessed. A propType
// with no entry here (either free-typed outside the suggested list, or a suggested one
// ESPN just doesn't expose cleanly, e.g. "Longest Completion" has no matching stat key)
// always resolves as "unmappable" in resolveLeg -- stays manual-only, never a guess.
//
// Each mapping is a list of {group, key} stat references, both drawn from ESPN's own
// stable `keys` array (not its free-text display labels, which are more likely to drift).
// A single-entry list is a direct numeric read. A multi-entry list means: for a
// PLAYER_PROP (numeric over/under), SUM the entries (e.g. "Rush + Rec Yards"); for a
// PLAYER_PROP_YESNO, the entries are OR'd -- clinches YES the moment any one is nonzero
// (e.g. "Anytime TD" checking every way a player can score across position groups).
export type StatRef = { group: string; key: string; extract?: "numerator" | "denominator" };
export type PropStatMapping = StatRef[];

// NFL and MLB are the only two leagues verified against real box scores this pass (see the
// event ids above). NBA and NHL are off-season right now -- deliberately left unmapped
// rather than guessing at ESPN's key names for them; add once a live/recent game can
// confirm the real `keys` arrays, same discipline used to build these two.
const NFL: Record<string, PropStatMapping> = {
  "Passing Yards": [{ group: "passing", key: "passingYards" }],
  "Passing TDs": [{ group: "passing", key: "passingTouchdowns" }],
  Completions: [{ group: "passing", key: "completions/passingAttempts", extract: "numerator" }],
  "Pass Attempts": [{ group: "passing", key: "completions/passingAttempts", extract: "denominator" }],
  "Interceptions Thrown": [{ group: "passing", key: "interceptions" }],
  "Rushing Yards": [{ group: "rushing", key: "rushingYards" }],
  "Rushing Attempts": [{ group: "rushing", key: "rushingAttempts" }],
  "Longest Rush": [{ group: "rushing", key: "longRushing" }],
  Receptions: [{ group: "receiving", key: "receptions" }],
  "Receiving Yards": [{ group: "receiving", key: "receivingYards" }],
  "Longest Reception": [{ group: "receiving", key: "longReception" }],
  "Rush + Rec Yards": [
    { group: "rushing", key: "rushingYards" },
    { group: "receiving", key: "receivingYards" },
  ],
  "Kicking Points": [{ group: "kicking", key: "totalKickingPoints" }],
  "Field Goals Made": [{ group: "kicking", key: "fieldGoalsMade/fieldGoalAttempts", extract: "numerator" }],
  "Longest Field Goal": [{ group: "kicking", key: "longFieldGoalMade" }],
  "Extra Points Made": [{ group: "kicking", key: "extraPointsMade/extraPointAttempts", extract: "numerator" }],
  Sacks: [{ group: "defensive", key: "sacks" }],
  "Total Tackles": [{ group: "defensive", key: "totalTackles" }],
  "Tackles For Loss": [{ group: "defensive", key: "tacklesForLoss" }],
  "QB Hits": [{ group: "defensive", key: "QBHits" }],
  "Passes Defended": [{ group: "defensive", key: "passesDefended" }],
  Interceptions: [{ group: "interceptions", key: "interceptions" }],
  "Anytime TD": [
    { group: "rushing", key: "rushingTouchdowns" },
    { group: "receiving", key: "receivingTouchdowns" },
    { group: "defensive", key: "defensiveTouchdowns" },
    { group: "interceptions", key: "interceptionTouchdowns" },
    { group: "kickReturns", key: "kickReturnTouchdowns" },
    { group: "puntReturns", key: "puntReturnTouchdowns" },
  ],
};

const MLB: Record<string, PropStatMapping> = {
  Hits: [{ group: "batting", key: "hits" }],
  "Home Runs": [{ group: "batting", key: "homeRuns" }],
  RBIs: [{ group: "batting", key: "RBIs" }],
  "Runs Scored": [{ group: "batting", key: "runs" }],
  // Real DK/FD market ("H+R+RBI") -- summed from the same three already-verified keys
  // above, same multi-entry-sum convention as NFL's "Rush + Rec Yards".
  "Hits + Runs + RBIs": [
    { group: "batting", key: "hits" },
    { group: "batting", key: "runs" },
    { group: "batting", key: "RBIs" },
  ],
  Strikeouts: [{ group: "pitching", key: "strikeouts" }],
  "Earned Runs Allowed": [{ group: "pitching", key: "earnedRuns" }],
  "Hits Allowed": [{ group: "pitching", key: "hits" }],
  "Walks Allowed": [{ group: "pitching", key: "walks" }],
};

const MAPPINGS: Record<string, Record<string, PropStatMapping>> = { NFL, MLB };

export function resolvePropStatMapping(league: string, propType: string): PropStatMapping | undefined {
  return MAPPINGS[league]?.[propType];
}
