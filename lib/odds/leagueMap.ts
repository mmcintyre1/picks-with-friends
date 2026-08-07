// Maps a Window.league string to The Odds API's sport key(s). A league that isn't in
// here simply has no live-odds sync available and stays on the manual-entry path
// forever -- manual entry is a first-class path, not a fallback, so this is safe to
// leave sparse.
//
// NFL maps to TWO sport keys: preseason and regular season are entirely separate keys
// in The Odds API, not one key with a preseason flag. Querying both and merging means
// this works year-round without manually swapping keys in and out each August --
// whichever key currently has games in it contributes to the list, the other just
// returns an empty (and free, per the API's "no events returned costs nothing" rule).
export const LEAGUE_MAP: Record<string, string[]> = {
  NFL: ["americanfootball_nfl_preseason", "americanfootball_nfl"],
};

export function toSportKeys(league: string): string[] | undefined {
  return LEAGUE_MAP[league];
}
