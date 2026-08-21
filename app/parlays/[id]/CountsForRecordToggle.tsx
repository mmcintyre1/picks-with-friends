"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

import { setCountsForRecord } from "../actions";

// A correction, not a creation-time-only setting -- a parlay made as "real" can turn out
// to need excluding from the leaderboard later (or the reverse), so this stays editable
// for the parlay's whole lifetime, same as OddsOverrideEditor. Collapsed to a trophy icon
// (dim when off the record) + confirm modal, matching LockButton's pattern, to keep the
// slip's controls compact once a parlay's actually up and running.
export function CountsForRecordToggle({
  parlayId,
  countsForRecord,
}: {
  parlayId: string;
  countsForRecord: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await setCountsForRecord(parlayId, !countsForRecord);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        title={countsForRecord ? "Counts toward the record" : "Just for fun — not on the record"}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base opacity-80 transition hover:bg-white/5 hover:opacity-100"
      >
        <span className={countsForRecord ? "" : "opacity-40 grayscale"}>🏆</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={countsForRecord ? "Take this off the record?" : "Add this to the record?"}
      >
        <p className="text-sm text-muted">
          {countsForRecord
            ? "It'll keep playing out normally, just excluded from the all-time leaderboard."
            : "It'll count toward everyone's badges and the all-time leaderboard from here on."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button type="button" disabled={pending} onClick={confirm}>
            {pending ? "Saving…" : countsForRecord ? "🚫 Take it off" : "🏆 Add it on"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
