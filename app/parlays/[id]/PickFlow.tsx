"use client";

import { useState } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { PencilIcon } from "@/components/ui/icons";

import { CancelLegButton } from "./CancelLegButton";
import { LegRow } from "./LegRow";
import { NoPickSummary } from "./NoPickSummary";
import { PickLegForm } from "./PickLegForm";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  league: string | null;
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
  flair?: string | null;
  isMe: boolean;
  hasLeg: boolean;
  summary?: string;
  awayTeam?: string;
  homeTeam?: string;
  league?: string | null;
  odds?: string | null;
  date?: string;
};

export function PickFlow({
  parlayId,
  memberRows,
  myLegInitial,
  defaultLeague,
}: {
  parlayId: string;
  memberRows: MemberRow[];
  myLegInitial?: Initial;
  defaultLeague: string;
}) {
  const hasLeg = Boolean(myLegInitial);
  const [editing, setEditing] = useState(!hasLeg);

  // Members with no pick yet collapse into one line (NoPickSummary) instead of a full
  // near-empty card each -- my own no-pick case isn't in that line at all, since the
  // "Make your pick" section below already represents my slot.
  const pickedRows = memberRows.filter((m) => m.hasLeg);
  const waitingRows = memberRows.filter((m) => !m.hasLeg && !m.isMe);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {pickedRows.map((m) => (
          <LegRow
            key={m.userId}
            name={m.name}
            flair={m.flair}
            summary={m.summary}
            awayTeam={m.awayTeam}
            homeTeam={m.homeTeam}
            league={m.league}
            odds={m.odds}
            date={m.date}
            actions={
              m.isMe && !editing ? (
                <>
                  <button
                    type="button"
                    title="Edit pick"
                    onClick={() => setEditing(true)}
                    className="rounded-md border border-border-strong p-2.5 text-muted hover:text-foreground"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <CancelLegButton parlayId={parlayId} />
                </>
              ) : undefined
            }
          />
        ))}
        <NoPickSummary label="Waiting on:" members={waitingRows} />
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
            defaultLeague={defaultLeague}
            initial={myLegInitial}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}
