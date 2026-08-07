"use client";

import { useTransition } from "react";

import { ConfirmButton } from "@/components/ui/ConfirmButton";

import { cancelLeg } from "../actions";

export function CancelLegButton({ parlayId }: { parlayId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmButton
      label="Cancel pick"
      confirmLabel="Yes, remove it"
      pendingLabel="Canceling…"
      variant="destructive"
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          await cancelLeg(parlayId);
        })
      }
    />
  );
}
