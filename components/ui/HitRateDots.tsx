import type { HitRate } from "@/lib/playerstats/gamelogStats";

// Same win/loss color language as the leaderboard's own parlay dot-strip
// (app/leaderboard/page.tsx -- bg-win/bg-loss circles, oldest-to-newest left-to-right)
// reused deliberately for stylistic consistency rather than inventing a second convention.
// No checkmark/X glyph inside these, unlike the leaderboard's 20px dots: these are packed
// up to eight to a row inside a much smaller prop button, with no room for a legible glyph
// at that size. Color alone carries the signal here -- acceptable since the "L{n}" label
// plus the row's own hover tooltip (exact hit/game count and percentage) back it up, so
// nothing real is lost for anyone who can't rely on color alone.
//
// Dots and gaps shrink at the base breakpoint (real, measured cause: the O/U table's Over/
// Under buttons are only ever half of a shared column, unlike a ladder tile which gets the
// whole row -- confirmed via real getBoundingClientRect measurement that this row's own
// fixed content width, all shrink-0, overflowed its own button's box by 18-53px at every
// phone width tested (320/375/390) before this fix). Growing back to the roomier size from
// sm: up costs nothing, since that's exactly where the extra width actually exists.
export function HitRateDots({ rate }: { rate: HitRate }) {
  return (
    <div
      className="mt-1 flex w-full items-center justify-between gap-1 border-t border-border pt-1 sm:gap-1.5"
      title={`Hit ${rate.hits} of last ${rate.games} games (${rate.pct}%)`}
    >
      <span className="shrink-0 text-[8px] font-medium uppercase tracking-wide text-subtle">L{rate.games}</span>
      <div className="flex items-center gap-0.5">
        {rate.results.map((hit, i) => (
          <span key={i} className={`h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5 ${hit ? "bg-win" : "bg-loss"}`} />
        ))}
      </div>
    </div>
  );
}
