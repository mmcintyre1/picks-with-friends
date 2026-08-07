import type { ReactNode } from "react";

type Tone = "accent" | "pending" | "win" | "loss" | "muted";

const toneClass: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent",
  pending: "bg-pending/15 text-pending",
  win: "bg-win/15 text-win",
  loss: "bg-loss/15 text-loss",
  muted: "bg-white/5 text-muted",
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 font-display text-[11px] tracking-wide uppercase ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
