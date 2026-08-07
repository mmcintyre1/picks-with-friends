import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border shadow-md shadow-black/20 ${
        elevated ? "bg-gradient-to-b from-card-elevated to-card-elevated/80" : "bg-gradient-to-b from-card to-card/70"
      } ${className}`}
      {...props}
    />
  );
}
