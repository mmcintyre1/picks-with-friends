import type { ReactNode } from "react";

import { LegResult } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";

// Uses `ring` (box-shadow), not `border-*`, for the outcome tint -- Card already owns the
// `border-border` classes, and stacking a second `border-*` color utility on top of that
// risks losing depending on Tailwind's generated rule order rather than the order these
// classes are written in. A ring is a separate CSS mechanism, so it can't lose that fight.
function resultTintClass(result?: LegResult): string {
  if (result === LegResult.WIN) return "bg-win/10 ring-1 ring-inset ring-win/30";
  if (result === LegResult.LOSS) return "bg-loss/10 ring-1 ring-inset ring-loss/30";
  if (result === LegResult.PUSH) return "bg-push/10 ring-1 ring-inset ring-push/30";
  return "";
}

// Plain presentational row -- no hooks, so it renders identically whether it's used from
// a server component (LOCKED/RESOLVED) or a client component (OPEN, where "actions" needs
// interactive edit/cancel icons for your own row). Only ever rendered for a member who
// has a pick -- members with no pick yet collapse into NoPickSummary instead.
export function LegRow({
  name,
  flair,
  summary,
  odds,
  date,
  resultEmoji,
  result,
  actions,
}: {
  name: string;
  flair?: string | null;
  summary?: string;
  odds?: string | null;
  date?: string;
  resultEmoji?: string;
  // Only meaningful once a parlay is RESOLVED -- drives the row's win/loss/push tint.
  result?: LegResult;
  actions?: ReactNode;
}) {
  return (
    <Card className={`flex items-center justify-between gap-3 p-3 ${resultTintClass(result)}`}>
      <div className="min-w-0">
        <PlayerName name={name} flair={flair} className="text-base font-medium" />
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="text-foreground">{summary}</span>
          {odds && <span className="font-display tracking-wide text-accent tabular-nums">{odds}</span>}
          {date && <span className="text-xs text-subtle">{date}</span>}
          {resultEmoji && <span>{resultEmoji}</span>}
        </p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </Card>
  );
}
