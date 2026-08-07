"use client";

import { useEffect, type ReactNode } from "react";

// A real dialog for consequential confirmations (locking a parlay, removing a pick) --
// deliberately not a portal: nothing in this app's layout sets transform/filter/perspective
// on an ancestor, so a `fixed` element positions against the viewport either way.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-border-strong bg-card-elevated p-4 shadow-xl shadow-black/50">
        <p className="font-display text-lg tracking-wide">{title}</p>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
