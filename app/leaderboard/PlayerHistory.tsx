import Link from "next/link";

import { Badge, LegResult } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";
import { ChevronDownIcon } from "@/components/ui/icons";
import { BADGE_EMOJI, BADGE_LABEL } from "@/lib/badges";

export type HistoryCell = {
  parlayId: string;
  badge: Badge;
  result: LegResult;
  title: string; // tooltip: date · parlay · pick
};

// Lone results (✝️/🗑️) get a stronger tint than plain wins/losses so they pop out of the
// grid like hot spots -- they're the notable moments in a player's run.
function cellClass(cell: HistoryCell): string {
  if (cell.result === LegResult.PUSH) return "bg-push/15 ring-push/30";
  switch (cell.badge) {
    case Badge.CROSS:
      return "bg-win/45 ring-win/70";
    case Badge.MONEYBAG:
      return "bg-win/15 ring-win/30";
    case Badge.TOILET:
      return "bg-loss/45 ring-loss/70";
    case Badge.POO:
      return "bg-loss/15 ring-loss/30";
    default:
      return "bg-white/5 ring-border";
  }
}

function cellEmoji(cell: HistoryCell): string {
  return cell.result === LegResult.PUSH ? "🆓" : BADGE_EMOJI[cell.badge] || "·";
}

function cellLabel(cell: HistoryCell): string {
  return cell.result === LegResult.PUSH ? "Push" : BADGE_LABEL[cell.badge] || "No badge";
}

export function PlayerHistory({ players }: { players: { name: string; flair: string | null; history: HistoryCell[] }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((player) => (
        <Card key={player.name} className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="font-medium">
                <PlayerName name={player.name} flair={player.flair} />
              </span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {player.history.length} pick{player.history.length === 1 ? "" : "s"}
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="flex flex-wrap gap-1 border-t border-border px-3 pt-3 pb-3">
              {player.history.map((cell, i) => (
                <Link
                  key={`${cell.parlayId}-${i}`}
                  href={`/parlays/${cell.parlayId}`}
                  title={`${cellLabel(cell)} — ${cell.title}`}
                  aria-label={`${cellLabel(cell)} — ${cell.title}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-base ring-1 ring-inset hover:brightness-125 ${cellClass(cell)}`}
                >
                  {cellEmoji(cell)}
                </Link>
              ))}
            </div>
          </details>
        </Card>
      ))}
      <p className="text-xs text-subtle">Oldest first. Brighter squares are lone wins (✝️) and lone losses (🗑️). Tap a square to open that parlay.</p>
    </div>
  );
}
