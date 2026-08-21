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
      {/* Permanently tinted, not just on hover -- hover doesn't exist on mobile, and this
          is the one control here where a misclick actually costs something, so it needs to
          read as different from the others at a glance, not just up close. */}
      <button
        type="button"
        title="Delete parlay"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-loss/10 text-base text-loss opacity-80 transition hover:bg-loss/20 hover:opacity-100"
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
