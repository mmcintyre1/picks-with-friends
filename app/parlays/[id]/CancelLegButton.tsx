"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { XIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";

import { cancelLeg } from "../actions";

export function CancelLegButton({ parlayId }: { parlayId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        title="Cancel pick"
        onClick={() => setOpen(true)}
        className="rounded-md border border-loss/40 p-1.5 text-loss hover:bg-loss/10"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Remove this pick?">
        <p className="text-sm text-muted">You can pick a different game or market again before the parlay locks.</p>
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
                await cancelLeg(parlayId);
                setOpen(false);
              })
            }
          >
            {pending ? "Removing…" : "Yes, remove it"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
