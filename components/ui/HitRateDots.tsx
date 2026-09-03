import type { HitRate } from "@/lib/playerstats/gamelogStats";

// Same win/loss color language as the leaderboard's own parlay dot-strip
// (app/leaderboard/page.tsx -- bg-win/bg-loss circles, oldest-to-newest left-to-right)
// reused deliberately for stylistic consistency rather than inventing a second convention.
// No checkmark/X glyph inside these, unlike the leaderboard's 20px dots: these are packed
// up to ten to a row inside a much smaller prop button, with no room for a legible glyph at
// that size. Color alone carries the signal here -- acceptable since the "L{n}" label plus
// the row's own hover tooltip (exact hit/game count and percentage) back it up, so nothing
// real is lost for anyone who can't rely on color alone.
export function HitRateDots({ rate }: { rate: HitRate }) {
  return (
    <div
      className="mt-1 flex w-full items-center justify-between gap-1.5 border-t border-border pt-1"
      title={`Hit ${rate.hits} of last ${rate.games} games (${rate.pct}%)`}
    >
      <span className="shrink-0 text-[8px] font-medium uppercase tracking-wide text-subtle">L{rate.games}</span>
      <div className="flex items-center gap-0.5">
        {rate.results.map((hit, i) => (
          <span key={i} className={`h-1.5 w-1.5 shrink-0 rounded-full ${hit ? "bg-win" : "bg-loss"}`} />
        ))}
      </div>
    </div>
  );
}
