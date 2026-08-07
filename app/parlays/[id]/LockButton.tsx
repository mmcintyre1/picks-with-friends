"use client";

import { useState, useTransition } from "react";

import { ConfirmButton } from "@/components/ui/ConfirmButton";

import { lockParlay } from "../actions";

export function LockButton({ parlayId }: { parlayId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <ConfirmButton
        label="Lock parlay"
        confirmLabel="Yes, lock it"
        pendingLabel="Locking…"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await lockParlay(parlayId);
            if (result?.error) setError(result.error);
          })
        }
      />
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
