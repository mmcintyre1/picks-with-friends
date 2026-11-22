import { DIRECTION_LABEL, type Correlation } from "@/lib/correlation";

const toneClass = {
  together: "border-push/40 bg-push/10",
  against: "border-loss/40 bg-loss/10",
  sameGame: "border-border bg-white/[0.03]",
} as const;

// Plain-language flags for picks that share a game. "Tend to hit together" is the one that
// matters for payout: a sportsbook pays noticeably less than the multiplied odds for those.
export function CorrelationNotes({ correlations, intro }: { correlations: Correlation[]; intro?: string }) {
  if (correlations.length === 0) return null;
  const together = correlations.some((c) => c.direction === "together");
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted">
        {intro ??
          (together
            ? "Some picks are correlated — a sportsbook would pay less than these multiplied odds. Enter the real number below if you have it."
            : "Some picks share a game:")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {correlations.map((c, i) => (
          <li key={i} className={`rounded-lg border px-3 py-2 text-xs ${toneClass[c.direction]}`}>
            <span className="font-medium text-foreground">
              {c.a.owner}: {c.a.summary}
            </span>
            <span className="text-subtle"> + </span>
            <span className="font-medium text-foreground">
              {c.b.owner}: {c.b.summary}
            </span>
            <span className="block text-muted">
              {DIRECTION_LABEL[c.direction]}
              {c.direction !== "sameGame" && ` — ${c.reason}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
