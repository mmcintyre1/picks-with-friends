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
    <div className="flex flex-col gap-1">
      <Button type="button" onClick={() => setOpen(true)} className="w-fit">
        Lock parlay
      </Button>
      {error && <p className="text-xs text-loss">{error}</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="Lock this parlay?">
        <p className="text-sm text-muted">
          No one will be able to add or change picks after this. Grading opens up once it&apos;s locked.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button type="button" disabled={pending} onClick={confirm}>
            {pending ? "Locking…" : "Yes, lock it"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
