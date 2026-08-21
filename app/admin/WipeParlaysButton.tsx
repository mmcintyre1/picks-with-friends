"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

import { wipeAllParlays } from "../parlays/actions";

export function WipeParlaysButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  return (
    <>
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Wipe all parlays ({count})
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Wipe every parlay?">
        <p className="text-sm text-muted">
          Deletes all {count} parlay{count === 1 ? "" : "s"} and every pick on them, resetting the leaderboard back
          to zero. Player accounts, names, and PINs are untouched. Can&apos;t be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await wipeAllParlays();
                setOpen(false);
              })
            }
          >
            {pending ? "Wiping…" : "Yes, wipe everything"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
