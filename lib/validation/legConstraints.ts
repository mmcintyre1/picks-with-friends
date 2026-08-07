// Legs in a parlay must be on distinct games, unless the window is inherently a single
// real-world game (SNF/TNF/MNF, or a Free-for-all the creator marked as one) -- there's
// nothing to diversify across in that case.
//
// `otherLegs` must be the OTHER members' legs in this parlay (exclude the current
// user's own leg, if any, before calling -- re-picking your own game isn't a conflict).
export function canPickGame(
  gameId: string,
  isSingleGameWindow: boolean,
  otherLegs: { gameId: string }[],
): { ok: true } | { ok: false; reason: string } {
  if (isSingleGameWindow) return { ok: true };
  const alreadyUsed = otherLegs.some((leg) => leg.gameId === gameId);
  if (!alreadyUsed) return { ok: true };
  return {
    ok: false,
    reason: "Someone else already picked this game. Pick a different one.",
  };
}
