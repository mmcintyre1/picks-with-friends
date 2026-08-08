import type { ReactNode } from "react";

type Tone = "accent" | "pending" | "win" | "loss" | "muted";

const toneClass: Record<Tone, string> = {
  accent: "bg-accent/20 text-accent",
  pending: "bg-pending/20 text-pending",
  win: "bg-win/20 text-win",
  loss: "bg-loss/20 text-loss",
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
