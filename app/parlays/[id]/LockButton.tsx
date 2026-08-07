"use client";

import { useState, useTransition } from "react";

import { lockParlay } from "../actions";

export function LockButton({ parlayId }: { parlayId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await lockParlay(parlayId);
            if (result?.error) setError(result.error);
          })
        }
        className="w-fit rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Locking…" : "Lock parlay"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
