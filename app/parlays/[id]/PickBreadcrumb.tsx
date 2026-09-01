"use client";

// Lightweight wayfinding for the pick flow's 3-4-level drill-down (sport -> game ->
// category tab -> optional segment tab -> tier), which has no other step indicator
// anywhere. Deliberately a breadcrumb, not a step-count/progress-dots wizard -- the page
// itself is one continuous scroll built around expand-in-place accordions and tab bars, and
// a rigid wizard would fight that model instead of fitting it. Replaces the icon-only
// "change game" arrow with something that also shows *what* you'd be going back from.
export function PickBreadcrumb({
  sport,
  awayTeam,
  homeTeam,
  onBack,
}: {
  sport: string;
  awayTeam: string;
  homeTeam: string;
  onBack: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        {sport}
      </button>
      <span className="shrink-0 text-subtle">/</span>
      <span className="min-w-0 truncate font-medium text-foreground">
        {awayTeam} @ {homeTeam}
      </span>
    </div>
  );
}
