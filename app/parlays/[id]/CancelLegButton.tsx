"use client";

import { useTransition } from "react";

import { cancelLeg } from "../actions";

export function CancelLegButton({ parlayId }: { parlayId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await cancelLeg(parlayId);
        })
      }
      className="text-xs text-red-500 underline disabled:opacity-50"
    >
      {pending ? "Canceling…" : "Cancel pick"}
    </button>
  );
}
