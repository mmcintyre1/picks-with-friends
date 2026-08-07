import { Badge, LegResult } from "@/app/generated/prisma/enums";

type GradedLeg = { id: string; result: LegResult };

// Rule: pushes never get a badge. Among the remaining win/loss legs, if exactly one
// differs from the rest (a 3-1 split, or a 2-1 split in a 3-leg parlay), that lone leg
// gets TOILET (lone loss) or CROSS (lone win) instead of its plain badge; everyone else
// gets the plain MONEYBAG/POO for their own result.
//
// A 1-1 split (2 non-push legs) is deliberately treated as plain badges for both, not
// toilet+cross -- "lone" implies being the odd one out against a real majority (2+), and
// a 2-leg parlay has no majority, just a tie.
export function computeBadges(legs: GradedLeg[]): Record<string, Badge> {
  const nonPush = legs.filter((leg) => leg.result !== LegResult.PUSH);
  const wins = nonPush.filter((leg) => leg.result === LegResult.WIN);
  const losses = nonPush.filter((leg) => leg.result === LegResult.LOSS);

  const isLoneLoss = losses.length === 1 && wins.length >= 2;
  const isLoneWin = wins.length === 1 && losses.length >= 2;

  const badges: Record<string, Badge> = {};
  for (const leg of legs) {
    if (leg.result === LegResult.PUSH) {
      badges[leg.id] = Badge.NONE;
    } else if (leg.result === LegResult.WIN) {
      badges[leg.id] = isLoneWin ? Badge.CROSS : Badge.MONEYBAG;
    } else if (leg.result === LegResult.LOSS) {
      badges[leg.id] = isLoneLoss ? Badge.TOILET : Badge.POO;
    } else {
      badges[leg.id] = Badge.NONE;
    }
  }
  return badges;
}
