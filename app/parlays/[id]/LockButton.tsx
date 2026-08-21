"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

import { lockParlay } from "../actions";

export function LockButton({ parlayId }: { parlayId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await lockParlay(parlayId);
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
      // On success the page re-renders as LOCKED and this component unmounts.
    });
  }

  return (
    <div className="relative">
      {/* Shows the CURRENT state (open), not a preview of the action -- an already-closed
          padlock here would read as "this is already locked," which is backwards for a
          button that only ever renders while the parlay is still OPEN. */}
      <button
        type="button"
        title="Open — tap to lock"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base opacity-80 transition hover:bg-white/5 hover:opacity-100"
      >
        🔓
      </button>
      {/* Floats below the icon instead of squeezing into its narrow column -- this button
          sits in a tight horizontal row of same-size icons, not a block layout. */}
      {error && (
        <p className="absolute top-full right-0 z-10 mt-1 w-48 text-right text-xs text-loss">{error}</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Lock this parlay?">
        <p className="text-sm text-muted">
          No one will be able to add or change picks after this. It opens up for evaluation once it&apos;s locked.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button type="button" disabled={pending} onClick={confirm}>
            {pending ? "Locking…" : "🔒 Yes, lock it"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
