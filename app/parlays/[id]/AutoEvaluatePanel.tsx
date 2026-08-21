"use client";

import { useState } from "react";

import { LegResult } from "@/app/generated/prisma/enums";

import type { EvaluateOutcome } from "../actions";
import { EvaluateButton } from "./EvaluateButton";
import { GradeForm } from "./GradeForm";

type Leg = { id: string; userName: string; summary: string };

// Wraps GradeForm rather than changing it -- GradeForm already supports a partial
// initialResults object (only some legs pre-filled, the rest left for a human), so this
// just supplies that plus a live per-leg status caption for whatever didn't clinch yet,
// and the manual path underneath is completely unaffected.
export function AutoEvaluatePanel({
  parlayId,
  legs,
  lastEvaluatedAt,
}: {
  parlayId: string;
  legs: Leg[];
  lastEvaluatedAt: Date | null;
}) {
  const [initialResults, setInitialResults] = useState<Record<string, LegResult>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  // GradeForm seeds its local state from initialResults only once, on mount -- bumping
  // this key forces a clean remount whenever a new Evaluate call hands back fresh results,
  // instead of the pre-filled values silently going stale.
  const [formKey, setFormKey] = useState(0);

  function handleOutcome(outcome: EvaluateOutcome) {
    setInitialResults((prev) => ({ ...prev, ...outcome.results }));
    setStatuses(outcome.statuses);
    setFormKey((k) => k + 1);
  }

  const statusEntries = legs.filter((leg) => statuses[leg.id]);

  return (
    <div className="flex flex-col gap-3">
      <EvaluateButton parlayId={parlayId} lastEvaluatedAt={lastEvaluatedAt} onOutcome={handleOutcome} />
      {statusEntries.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted">
          {statusEntries.map((leg) => (
            <li key={leg.id}>
              <span className="font-medium">{leg.userName}:</span> {statuses[leg.id]}
            </li>
          ))}
        </ul>
      )}
      <GradeForm
        key={formKey}
        parlayId={parlayId}
        legs={legs}
        initialResults={Object.keys(initialResults).length > 0 ? initialResults : undefined}
        isCorrection={false}
      />
    </div>
  );
}
