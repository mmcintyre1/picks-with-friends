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
