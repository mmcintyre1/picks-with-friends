// Pill styling stays fixed-shape across every tier so a streak cell never reflows --
// only color/weight scale with length ("hotness"), no icon that appears/disappears.
// inline-flex + items-center (not inline-block) because the emoji glyph and the digit
// don't share a font baseline -- left to normal inline text flow they render at visibly
// different heights; flex alignment centers them against each other instead.
export function streakPillClass(count: number, isWin: boolean): string {
  const base = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-display tracking-wide tabular-nums";
  if (isWin) {
    if (count >= 5) return `${base} bg-win font-bold text-win-foreground`;
    if (count >= 3) return `${base} bg-win/20 font-semibold text-win`;
    return `${base} text-win`;
  }
  if (count >= 5) return `${base} bg-loss font-bold text-loss-foreground`;
  if (count >= 3) return `${base} bg-loss/20 font-semibold text-loss`;
  return `${base} text-loss`;
}

export function StreakPill({ count, isWin }: { count: number; isWin: boolean }) {
  return (
    <span className={streakPillClass(count, isWin)}>
      <span>{count}</span>
      <span>{isWin ? "💰" : "💩"}</span>
    </span>
  );
}
