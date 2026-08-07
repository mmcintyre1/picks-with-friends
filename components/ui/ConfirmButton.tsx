"use client";

import { useState } from "react";

import { Button } from "./Button";

// Two-stage confirm: first click reveals an inline "Sure? [Yes] [Never mind]" row instead
// of firing immediately -- the caller still owns the pending/error state around onConfirm.
export function ConfirmButton({
  label,
  confirmLabel,
  pendingLabel,
  onConfirm,
  pending = false,
  variant = "primary",
  className = "",
}: {
  label: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  variant?: "primary" | "destructive";
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-muted">Sure?</span>
        <Button type="button" variant={variant} size="sm" disabled={pending} onClick={onConfirm}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Never mind
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant={variant} onClick={() => setConfirming(true)} className={className}>
      {label}
    </Button>
  );
}
