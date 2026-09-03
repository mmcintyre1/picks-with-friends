import type { ReactNode } from "react";

import { LegResult } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";
import { teamLogoUrl } from "@/lib/rosters/leagues";

import { TeamLabel } from "./TeamMarketGrid";

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

const teamLineTextClass = "text-xs text-subtle sm:text-sm";

// TeamLabel's own default icon size (18px) reused everywhere else this app shows a team
// logo -- this row used to override it down to a flat 16px at every breakpoint, smaller
// than that default rather than just matching it, and on a real mobile screen a small
// sports crest at that size read as "almost not even there" (real, reported complaint).
// Every pick on the whole app funnels through this one row, so this is the single highest-
// traffic team-logo spot in the app -- worth its own real size, not the smallest one.
const teamLogoSize = "h-5 w-5 sm:h-6 sm:w-6";

// Plain presentational row -- no hooks, so it renders identically whether it's used from
// a server component (LOCKED/RESOLVED) or a client component (OPEN, where "actions" needs
// interactive edit/cancel icons for your own row). Only ever rendered for a member who
// has a pick -- members with no pick yet collapse into NoPickSummary instead.
//
// Deliberately three fixed lines (name+badge / bet+odds / game+time) instead of one big
// flex-wrap line -- the old layout let the game time wrap onto its own line or not
// depending on how long the bet description happened to be, so two picks could look
// structurally different from each other for no reason other than text length. Each line
// truncates its own pieces with an ellipsis instead of wrapping, so the row height never
// changes and nothing ever reflows unpredictably. Text sizes step up at `sm:` so desktop's
// extra width goes toward bigger, easier-to-read text rather than sitting empty next to a
// single short line.
export function LegRow({
  name,
  flair,
  summary,
  awayTeam,
  homeTeam,
  league,
  odds,
  date,
  resultEmoji,
  result,
  actions,
}: {
  name: string;
  flair?: string | null;
  summary?: string;
  // The matchup this pick belongs to -- a total or player prop's own summary text never
  // names a game (a total isn't team-specific, a player's team isn't inferable from their
  // name alone), so without this there's no way to tell which game a pick like "Over
  // 35.5" actually refers to. Reuses TeamMarketGrid's TeamLabel (same logos already used
  // in the pick grid) rather than showing plain team-name text.
  awayTeam?: string;
  homeTeam?: string;
  league?: string | null;
  odds?: string | null;
  date?: string;
  resultEmoji?: string;
  // Only meaningful once a parlay is RESOLVED -- drives the row's win/loss/push tint.
  result?: LegResult;
  actions?: ReactNode;
}) {
  const effectiveLeague = league ?? "";

  return (
    <Card className={`flex items-center justify-between gap-3 p-3 sm:p-4 ${resultTintClass(result)}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <PlayerName name={name} flair={flair} className="text-base font-medium sm:text-lg" />
          {resultEmoji && <span className="text-sm sm:text-base">{resultEmoji}</span>}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-foreground sm:text-base">{summary}</span>
          {odds && (
            <span className="shrink-0 font-display text-sm tracking-wide text-accent tabular-nums sm:text-base">
              {odds}
            </span>
          )}
        </div>
        {(awayTeam || homeTeam || date) && (
          <div className="mt-0.5 flex items-center justify-between gap-3">
            {awayTeam && homeTeam && (
              <span className="flex min-w-0 items-center gap-1 truncate">
                <TeamLabel
                  name={awayTeam}
                  logo={teamLogoUrl(effectiveLeague, awayTeam)}
                  league={effectiveLeague}
                  size={teamLogoSize}
                  textClassName={teamLineTextClass}
                />
                <span className={`${teamLineTextClass} shrink-0`}>@</span>
                <TeamLabel
                  name={homeTeam}
                  logo={teamLogoUrl(effectiveLeague, homeTeam)}
                  league={effectiveLeague}
                  size={teamLogoSize}
                  textClassName={teamLineTextClass}
                />
              </span>
            )}
            {date && <span className={`${teamLineTextClass} shrink-0`}>{date}</span>}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </Card>
  );
}
