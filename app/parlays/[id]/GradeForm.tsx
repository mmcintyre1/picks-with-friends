"use client";

import { useState, useTransition } from "react";

import { LegResult } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import { gradeParlay } from "../actions";

type Leg = { id: string; userName: string; summary: string };

const RESULT_OPTIONS: { value: LegResult; label: string; activeClassName: string }[] = [
  { value: LegResult.WIN, label: "Win", activeClassName: "bg-win text-win-foreground uppercase" },
  { value: LegResult.LOSS, label: "Loss", activeClassName: "bg-loss text-loss-foreground uppercase" },
  { value: LegResult.PUSH, label: "Push", activeClassName: "bg-push text-push-foreground uppercase" },
];

export function GradeForm({
  parlayId,
  legs,
  initialResults,
  isCorrection,
  onCancel,
}: {
  parlayId: string;
  legs: Leg[];
  initialResults?: Record<string, LegResult>;
  // Distinct from "initialResults is present" -- AutoEvaluatePanel also passes a partial
  // initialResults on a first-time (LOCKED) evaluation, which isn't a correction at all,
  // just an auto-assisted head start. Defaults to the old inference for ResolvedGradeEditor's
  // call site (a real initialResults there always means a genuine correction).
  isCorrection?: boolean;
  onCancel?: () => void;
}) {
  const [results, setResults] = useState<Record<string, LegResult>>(initialResults ?? {});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = isCorrection ?? Boolean(initialResults);
  const gradedCount = legs.filter((leg) => results[leg.id]).length;
  const complete = gradedCount === legs.length;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await gradeParlay(parlayId, results);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{isEdit ? "Fix the evaluation" : "Evaluate this parlay"}</h2>
          <span className="text-xs text-muted">
            {gradedCount} of {legs.length} evaluated
          </span>
        </div>
        {legs.map((leg) => (
          <div key={leg.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{leg.userName}</p>
              <p className="text-xs text-muted">{leg.summary}</p>
            </div>
            <SegmentedControl
              size="sm"
              name={`Result for ${leg.userName}`}
              value={results[leg.id] ?? null}
              onChange={(v) => setResults((r) => ({ ...r, [leg.id]: v }))}
              options={RESULT_OPTIONS}
            />
          </div>
        ))}
        {error && <p className="text-xs text-loss">{error}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending || !complete}>
            {pending ? "Saving…" : isEdit ? "Save the correction" : "Submit evaluation"}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Never mind
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
