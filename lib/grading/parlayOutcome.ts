import { Badge, LegResult } from "@/app/generated/prisma/enums";

export type ParlayOutcome = "win" | "loneLoss" | "loneWin" | "reverse" | "loss";

// What made a resolved parlay notable, for the leaderboard's group strip. Built on the same
// leg badges computeBadges already assigns, so it can't disagree with them: a trash can means
// one leg sank an otherwise-winning parlay, a cross means one leg was the only hit. A
// "reverse" (reverse parlay) is one where nobody hit -- betting against everyone would have
// cashed. Pushes are ignored throughout, as in the badge rules.
export function parlayOutcome(result: LegResult | null, legs: { result: LegResult; badge: Badge }[]): ParlayOutcome {
  if (result === LegResult.WIN) return "win";
  if (legs.some((l) => l.badge === Badge.TOILET)) return "loneLoss";
  if (legs.some((l) => l.badge === Badge.CROSS)) return "loneWin";
  const decided = legs.filter((l) => l.result === LegResult.WIN || l.result === LegResult.LOSS);
  if (decided.length >= 2 && decided.every((l) => l.result === LegResult.LOSS)) return "reverse";
  return "loss";
}
