"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

import { deleteParlay } from "../actions";

// Same deleteParlay action the admin parlay list already uses -- this just adds the
// option directly on the parlay's own page (any status, matching the admin list's reach)
// instead of requiring a trip to Players to find it. Since deleting removes the page
// itself, a successful delete navigates back to the dashboard rather than re-rendering
// in place.
export function DeleteParlayButton({ parlayId }: { parlayId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteParlay(parlayId);
      if (result?.error) {
        setError(result.error);
        setOpen(false);
        return;
      }
      router.push("/");
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Delete parlay"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base opacity-80 transition hover:bg-loss/10 hover:opacity-100"
      >
        🗑️
      </button>
      {error && <p className="absolute top-full right-0 z-10 mt-1 w-48 text-right text-xs text-loss">{error}</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="Delete this parlay?">
        <p className="text-sm text-muted">
          Permanently removes it and every pick on it, including from the leaderboard if it counted toward the
          record. Can&apos;t be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? "Deleting…" : "🗑️ Yes, delete it"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
