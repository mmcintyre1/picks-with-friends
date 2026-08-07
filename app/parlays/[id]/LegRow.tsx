import type { ReactNode } from "react";

import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";

// Plain presentational row -- no hooks, so it renders identically whether it's used from
// a server component (LOCKED/RESOLVED) or a client component (OPEN, where "actions" needs
// interactive edit/cancel icons for your own row).
export function LegRow({
  name,
  flair,
  noPick,
  summary,
  odds,
  date,
  resultEmoji,
  actions,
}: {
  name: string;
  flair?: string | null;
  noPick?: boolean;
  summary?: string;
  odds?: string | null;
  date?: string;
  resultEmoji?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <PlayerName name={name} flair={flair} className="text-base font-medium" />
        {noPick ? (
          <p className="text-sm text-subtle">No pick yet</p>
        ) : (
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="text-foreground">{summary}</span>
            {odds && <span className="font-display tracking-wide text-accent tabular-nums">{odds}</span>}
            {date && <span className="text-xs text-subtle">{date}</span>}
            {resultEmoji && <span>{resultEmoji}</span>}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </Card>
  );
}
