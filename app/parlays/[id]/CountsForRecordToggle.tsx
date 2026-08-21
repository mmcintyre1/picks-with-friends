"use client";

import { useTransition } from "react";

import { setCountsForRecord } from "../actions";

// A correction, not a creation-time-only setting -- a parlay made as "real" can turn out
// to need excluding from the leaderboard later (or the reverse), so this stays editable
// for the parlay's whole lifetime, same as OddsOverrideEditor.
export function CountsForRecordToggle({
  parlayId,
  countsForRecord,
}: {
  parlayId: string;
  countsForRecord: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs">
      <span className={countsForRecord ? "text-subtle" : "text-push"}>
        {countsForRecord ? "Counts toward the record" : "Just for fun — doesn't count toward the record"}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setCountsForRecord(parlayId, !countsForRecord);
          })
        }
        className="text-muted underline hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : countsForRecord ? "Remove from record" : "Add back to record"}
      </button>
    </p>
  );
}
