"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

import { unlockParlay } from "../actions";

export function UnlockButton({ parlayId }: { parlayId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await unlockParlay(parlayId);
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
      // On success the page re-renders as OPEN and this component unmounts.
    });
  }

  return (
    <div className="relative">
      {/* Shows the CURRENT state (locked) -- this button only ever renders while the
          parlay actually is locked, matching LockButton's same current-state-not-action
          reasoning. */}
      <button
        type="button"
        title="Locked — tap to unlock"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base opacity-80 transition hover:bg-white/5 hover:opacity-100"
      >
        🔒
      </button>
      {error && (
        <p className="absolute top-full right-0 z-10 mt-1 w-48 text-right text-xs text-loss">{error}</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Unlock this parlay?">
        <p className="text-sm text-muted">
          Reopens it for picks — anyone can add or change theirs again until it&apos;s relocked.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button type="button" disabled={pending} onClick={confirm}>
            {pending ? "Unlocking…" : "🔓 Yes, unlock it"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
