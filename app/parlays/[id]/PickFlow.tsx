"use client";

import { useState } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { PencilIcon } from "@/components/ui/icons";

import { CancelLegButton } from "./CancelLegButton";
import { LegRow } from "./LegRow";
import { LockButton } from "./LockButton";
import { PickLegForm } from "./PickLegForm";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  line: number | null;
  price: number | null;
  playerName: string | null;
  propType: string | null;
};

export type MemberRow = {
  userId: string;
  name: string;
  isMe: boolean;
  hasLeg: boolean;
  summary?: string;
  odds?: string | null;
  date?: string;
};

export function PickFlow({
  parlayId,
  memberRows,
  myLegInitial,
  singleGame,
  usedGames,
  liveOddsAvailable,
  league,
  isCreator,
}: {
  parlayId: string;
  memberRows: MemberRow[];
  myLegInitial?: Initial;
  singleGame: boolean;
  usedGames: { homeTeam: string; awayTeam: string }[];
  liveOddsAvailable: boolean;
  league: string;
  isCreator: boolean;
}) {
  const hasLeg = Boolean(myLegInitial);
  const [editing, setEditing] = useState(!hasLeg);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {memberRows.map((m) => (
          <LegRow
            key={m.userId}
            name={m.name}
            noPick={!m.hasLeg}
            summary={m.summary}
            odds={m.odds}
            date={m.date}
            actions={
              m.isMe && m.hasLeg && !editing ? (
                <>
                  <button
                    type="button"
                    title="Edit pick"
                    onClick={() => setEditing(true)}
                    className="rounded-md border border-border-strong p-1.5 text-muted hover:text-foreground"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <CancelLegButton parlayId={parlayId} />
                </>
              ) : undefined
            }
          />
        ))}
      </div>

      {(editing || !hasLeg) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
              {hasLeg ? "Change your pick" : "Make your pick"}
            </h2>
            {hasLeg && (
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted underline">
                Collapse
              </button>
            )}
          </div>
          <PickLegForm
            parlayId={parlayId}
            singleGame={singleGame}
            usedGames={usedGames}
            liveOddsAvailable={liveOddsAvailable}
            league={league}
            initial={myLegInitial}
            onDone={() => setEditing(false)}
          />
        </div>
      )}

      {isCreator && <LockButton parlayId={parlayId} />}
    </div>
  );
}
