import { LegResult } from "@/app/generated/prisma/enums";

export function americanToDecimal(price: number): number {
  return price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
}

export function decimalToAmerican(decimal: number): number {
  return decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1);
}

export function formatAmericanOdds(american: number): string {
  const rounded = Math.round(american);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

// Standard parlay rule: a push leg is removed from the parlay entirely (its odds don't
// factor in), not treated as a loss or a neutral 1x multiplier. Returns null if any
// remaining (non-push) leg has no recorded price -- can't compute combined odds without
// every leg's price, so the caller should show "N/A" rather than a wrong number.
export function computeCombinedOdds(
  legs: { priceAtPick: number | null; result: LegResult }[],
): number | null {
  const counted = legs.filter((leg) => leg.result !== LegResult.PUSH);
  if (counted.length === 0) return null;
  if (counted.some((leg) => leg.priceAtPick === null)) return null;

  return counted.reduce((acc, leg) => acc * americanToDecimal(leg.priceAtPick as number), 1);
}

// Same-game legs are correlated, so a real sportsbook doesn't price a same-game parlay
// as the naive product of each leg's standalone odds -- and there's no way to derive
// that correlated number ourselves. `oddsOverride` (American odds, set via the parlay's
// "Override odds" control) takes precedence over the computed value when present.
export function effectiveCombinedOdds(
  legs: { priceAtPick: number | null; result: LegResult }[],
  oddsOverride: number | null,
): number | null {
  if (oddsOverride != null) return americanToDecimal(oddsOverride);
  return computeCombinedOdds(legs);
}

// Profit on top of the stake if the parlay hits (i.e. NOT including the returned stake).
export function computeProfit(stake: number, combinedDecimalOdds: number): number {
  return stake * (combinedDecimalOdds - 1);
}

// `results` must be in chronological order (oldest first). Returns the run of identical
// results ending at the most recent one, or null if there are no resolved parlays yet.
// Only WIN/LOSS are meaningful for a streak -- there's no such thing here since a
// parlay's overall result is always WIN or LOSS (see gradeParlay), never PUSH/PENDING.
export function computeCurrentStreak(
  results: LegResult[],
): { result: LegResult; count: number } | null {
  if (results.length === 0) return null;

  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) {
    count++;
  }
  return { result: last, count };
}

// Longest-ever run of a given result across the whole history, not just the trailing
// streak -- e.g. a player's best-ever win streak or worst-ever losing streak, which can
// easily be in the past even if their *current* streak (computeCurrentStreak) is short.
export function computeLongestStreak(results: LegResult[], target: LegResult): number {
  let longest = 0;
  let current = 0;
  for (const result of results) {
    if (result === target) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}
