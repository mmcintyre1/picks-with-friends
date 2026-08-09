"use client";

import { useState } from "react";

import { LegResult } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";
import { ChevronDownIcon } from "@/components/ui/icons";

import { StreakPill } from "./streakPill";

export type LeaderboardRow = {
  name: string;
  flair: string | null;
  moneybag: number;
  poo: number;
  toilet: number;
  cross: number;
  pushes: number;
  last10: { wins: number; losses: number };
  streak: { result: LegResult; count: number } | null;
  bestStreak: number;
  worstStreak: number;
};

// Collapsed by default -- record + current streak is the "at a glance" number, everything
// else (pushes, L10, bonus badges, best/worst streaks) is real but secondary detail that
// doesn't need to fight for space on a phone-width card every time.
export function MobileStatsCard({ row }: { row: LeaderboardRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-medium">
          <PlayerName name={row.name} flair={row.flair} />
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted">
            {row.moneybag}-{row.poo}
          </span>
          {row.streak ? (
            <StreakPill count={row.streak.count} isWin={row.streak.result === LegResult.WIN} />
          ) : (
            <span className="text-xs text-subtle">—</span>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {expanded && (
        <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3 border-t border-border pt-3 text-center text-xs">
          <div>
            <p className="text-subtle">🆓 Push</p>
            <p className="text-push tabular-nums">{row.pushes}</p>
          </div>
          <div>
            <p className="text-subtle">L10</p>
            <p className="text-muted tabular-nums">
              {row.last10.wins}-{row.last10.losses}
            </p>
          </div>
          <div>
            <p className="text-subtle">🗑️ Lone loss</p>
            <p className="text-loss tabular-nums">{row.toilet}</p>
          </div>
          <div>
            <p className="text-subtle">✝️ Lone win</p>
            <p className="text-win tabular-nums">{row.cross}</p>
          </div>
          <div className="col-span-2">
            <p className="text-subtle">Best streak</p>
            {row.bestStreak > 0 ? (
              <StreakPill count={row.bestStreak} isWin={true} />
            ) : (
              <span className="text-subtle">—</span>
            )}
          </div>
          <div className="col-span-2">
            <p className="text-subtle">Worst streak</p>
            {row.worstStreak > 0 ? (
              <StreakPill count={row.worstStreak} isWin={false} />
            ) : (
              <span className="text-subtle">—</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
