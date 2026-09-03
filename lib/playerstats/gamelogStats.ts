import { Side } from "@/app/generated/prisma/enums";

import type { EspnGameLogResponse, GameLogEntry } from "./types";

// Canonical propType -> the ESPN game-log column name(s) that stat lives in.
//
// Deliberately its own table rather than reusing lib/evaluate/statLabels.ts, even though both
// map the same canonical propType vocabulary onto ESPN stat keys: statLabels.ts targets the
// *box score* endpoint, which returns some stats as one combined string (its "Completions"
// entry reads `completions/passingAttempts` with extract:"numerator", because a box score
// literally reports "20/30"), whereas the *game log* endpoint exposes those as two separate
// columns. Same vocabulary, genuinely different column shapes -- forcing one table to serve
// both would have meant special-casing inside the shared lookup rather than just stating each
// endpoint's real columns plainly.
//
// Multi-entry lists are SUMMED. That's correct for genuine combined markets (Rush + Rec
// Yards) and also gives the right answer for the yes/no touchdown markets, where "did they
// score at all" is just "summed touchdowns >= 1".
//
// Every key below was confirmed present in a real live game-log response (a WR's and a QB's).
// Markets deliberately absent, rather than guessed at:
//   - 1st/Last TD Scorer: a game log reports cumulative per-game totals, not the order scores
//     happened in, so "who scored first" genuinely isn't answerable from this data.
//   - Kicking (Kicking Points / Field Goals Made / Extra Points Made) and defensive markets
//     (Total/Solo/Assisted Tackles): plausible, but this phase never pulled a real kicker or
//     defender game log to confirm the column names, and the whole point of this table is
//     that every entry is confirmed rather than assumed.
const NFL_GAMELOG_STATS: Record<string, string[]> = {
  "Passing Yards": ["passingYards"],
  "Passing TDs": ["passingTouchdowns"],
  "Pass Attempts": ["passingAttempts"],
  Completions: ["completions"],
  "Interceptions Thrown": ["interceptions"],
  "Longest Completion": ["longPassing"],
  "Pass + Rush Yards": ["passingYards", "rushingYards"],
  "Rushing Yards": ["rushingYards"],
  "Rushing Attempts": ["rushingAttempts"],
  "Longest Rush": ["longRushing"],
  "Rush + Rec Yards": ["rushingYards", "receivingYards"],
  "Receiving Yards": ["receivingYards"],
  Receptions: ["receptions"],
  "Longest Reception": ["longReception"],
  "Anytime TD": ["rushingTouchdowns", "receivingTouchdowns"],
  "Total TDs": ["rushingTouchdowns", "receivingTouchdowns"],
};

const GAMELOG_STATS_BY_LEAGUE: Record<string, Record<string, string[]>> = { NFL: NFL_GAMELOG_STATS };

export function gamelogStatKeys(league: string, propType: string): string[] | undefined {
  return GAMELOG_STATS_BY_LEAGUE[league]?.[propType];
}

// Reduces one real game-log response down to just the games and the single summed stat this
// propType cares about, newest game first. Returns [] when this athlete's log has none of the
// needed columns at all -- which is a real, expected case, not an error: the columns a log
// exposes depend on the athlete's position (a QB log has no receivingYards), so asking a
// quarterback about Receiving Yards legitimately has no answer.
export function extractGameLog(response: EspnGameLogResponse, statKeys: string[]): GameLogEntry[] {
  const indexes = statKeys.map((key) => response.names.indexOf(key)).filter((i) => i >= 0);
  if (indexes.length === 0) return [];

  const entries: GameLogEntry[] = [];
  const seenEventIds = new Set<string>();

  for (const seasonType of response.seasonTypes ?? []) {
    for (const category of seasonType.categories ?? []) {
      for (const event of category.events ?? []) {
        if (seenEventIds.has(event.eventId)) continue;
        seenEventIds.add(event.eventId);

        // Real logs use "-" for a stat that didn't apply in that game. A game where every
        // needed column is "-" means the player didn't record this stat at all (typically
        // didn't play) -- dropped rather than counted as a real zero, which would quietly
        // drag a hit rate down with games the player wasn't even in.
        const parsed = indexes.map((i) => Number(event.stats[i]));
        if (parsed.every((n) => Number.isNaN(n))) continue;
        const value = parsed.reduce((sum, n) => sum + (Number.isNaN(n) ? 0 : n), 0);

        const meta = response.events?.[event.eventId];
        entries.push({
          eventId: event.eventId,
          date: meta?.gameDate ?? "",
          opponent: meta?.opponent?.abbreviation ?? "",
          isHome: meta?.atVs !== "@",
          value,
        });
      }
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// Whether one real past game cleared the line.
//
// Fractional lines can't push, so > and >= agree on them. Whole-number lines are the
// ambiguous case, and in this app's real data they're overwhelmingly ParlayAPI's "N or more"
// milestone tiers (whose own market label literally reads "... Or More"), which hit at
// exactly N -- so Over uses >=, exact for those, at the cost of counting a true push as a hit
// on the rarer whole-number Over/Under line. Called out explicitly because this is *context*
// displayed next to a line, not money-settling logic: lib/evaluate/resolveLeg.ts grades real
// picks and treats a push as a push.
export function isHit(value: number, line: number, side: Side): boolean {
  if (side === Side.UNDER || side === Side.NO) return value < line;
  return value >= line;
}

// `results` is oldest-to-newest (left-to-right reading order), matching the exact
// convention app/leaderboard/page.tsx's own parlay dot-strip already established ("oldest
// first so the dot strip reads left-to-right chronologically") -- `entries` itself stays
// newest-first throughout this module since that's the natural order for "last N games,"
// but the moment this becomes a row of dots someone reads left to right, it needs to match
// the one dot-strip convention this app already has.
export type HitRate = { hits: number; games: number; pct: number; results: boolean[] };

// null when there's no history to judge against -- callers render nothing rather than a
// misleading "0%".
export function hitRate(entries: GameLogEntry[], line: number, side: Side, games: number): HitRate | null {
  const window = entries.slice(0, games);
  if (window.length === 0) return null;
  const hitFlags = window.map((e) => isHit(e.value, line, side));
  const hits = hitFlags.filter(Boolean).length;
  return { hits, games: window.length, pct: Math.round((hits / window.length) * 1000) / 10, results: [...hitFlags].reverse() };
}

// Real games against one specific opponent, newest first -- `entries` is already scoped to
// one propType, so this is just "and also only the games against them," e.g. for the
// player-breakout panel's "vs SEA" section. Opponent abbreviations are ESPN's own (already
// how GameLogEntry.opponent is populated), so this only ever matches real games, never a
// guess at formatting.
export function filterByOpponent(entries: GameLogEntry[], opponentAbbr: string): GameLogEntry[] {
  return entries.filter((e) => e.opponent === opponentAbbr);
}

// null for an empty list -- callers show "--" rather than a misleading 0.
export function average(entries: GameLogEntry[]): number | null {
  if (entries.length === 0) return null;
  return Math.round((entries.reduce((sum, e) => sum + e.value, 0) / entries.length) * 10) / 10;
}

// Normalizes a player name for matching a prop's own player string against a roster's
// displayName -- real mismatches are routine here ("AJ Barner" vs "A.J. Barner", already a
// confirmed real case in this app's own logo lookups), and a missed match just means no hit
// rate shown, so a little normalization is strictly better than exact-match-or-nothing.
export function normalizePlayerName(name: string): string {
  return name.toLowerCase().replace(/[.'\-\s]/g, "");
}
