import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border ${elevated ? "bg-card-elevated" : "bg-card"} ${className}`}
      {...props}
    />
  );
}
