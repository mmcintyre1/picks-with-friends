"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FREE_FOR_ALL_KEY, PARLAY_PRESETS } from "@/lib/parlayPresets";

import { createParlay } from "../actions";

const inputClass = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle";

const tagClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border bg-card text-muted hover:border-border-strong hover:text-foreground"
  }`;

// A perforated "tear line" between the slip's sections -- two half-circle notches punched
// out of the card edges plus a dashed rule, so the form reads as a ticket, not a plain form.
function TicketDivider() {
  return (
    <div className="relative -mx-4 flex items-center">
      <div className="-ml-2 h-4 w-4 shrink-0 rounded-full bg-page" />
      <div className="h-px flex-1 border-t border-dashed border-border-strong" />
      <div className="-mr-2 h-4 w-4 shrink-0 rounded-full bg-page" />
    </div>
  );
}

export function NewParlayForm() {
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [freeLeague, setFreeLeague] = useState("");
  const [freeLabel, setFreeLabel] = useState("");
  const [countsForRecord, setCountsForRecord] = useState(true);
  const [stake, setStake] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preset = PARLAY_PRESETS.find((p) => p.key === slotKey);
  const isCustom = slotKey === FREE_FOR_ALL_KEY;

  const disabledReason = !slotKey
    ? "Pick a label to continue."
    : isCustom && !freeLeague.trim()
      ? "Enter a league for the custom label."
      : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const league = preset ? preset.league : freeLeague;
    const label = preset ? preset.label : freeLabel;

    startTransition(async () => {
      const result = await createParlay({ league, label, countsForRecord, stake });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-dashed border-border-strong bg-accent/10 px-4 py-2">
        <span className="font-display text-xs uppercase tracking-[0.2em] text-accent">Parlay slip</span>
        <span className="text-[10px] uppercase tracking-wide text-subtle">New</span>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6 p-4">
        <p className="text-sm text-muted">
          Publish this and it&apos;s live for the group — everyone adds their own pick, anyone can lock it once
          picks are in, and anyone can evaluate it once the games are decided.
        </p>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Label</h2>
          <p className="text-xs text-subtle">
            Just a tag for this parlay — helps tell parlays apart. Whatever you pick here, every pick can still
            be its own sport (NFL, NBA, MLB, NHL, or anything else).
          </p>
          <div className="flex flex-wrap gap-2">
            {PARLAY_PRESETS.map((p) => {
              const active = slotKey === p.key;
              return (
                <button key={p.key} type="button" onClick={() => setSlotKey(p.key)} className={tagClass(active)}>
                  {p.label}
                </button>
              );
            })}
            <button type="button" onClick={() => setSlotKey(FREE_FOR_ALL_KEY)} className={tagClass(isCustom)}>
              Custom
            </button>
          </div>
        </div>

        <div className={`grid transition-all duration-200 ease-out ${isCustom ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                League
                <input
                  value={freeLeague}
                  onChange={(e) => setFreeLeague(e.target.value)}
                  placeholder="NFL, NBA, ..."
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Label (optional)
                <input
                  value={freeLabel}
                  onChange={(e) => setFreeLabel(e.target.value)}
                  placeholder="MNF Week 2, whatever"
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </div>

        <TicketDivider />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Stake</span>
            <div className="relative w-36">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display text-lg text-accent">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                required
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-card py-2 pr-3 pl-7 font-display text-lg tracking-wide text-foreground tabular-nums"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => setCountsForRecord((c) => !c)}
            aria-pressed={countsForRecord}
            title="Toggle whether this parlay counts toward the all-time leaderboard"
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              countsForRecord
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-card text-muted hover:border-border-strong"
            }`}
          >
            <span className={countsForRecord ? "" : "opacity-30 grayscale"}>🏆</span>
            {countsForRecord ? "On the record" : "Just for fun"}
          </button>
        </div>

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || Boolean(disabledReason)}>
            {pending ? "Publishing…" : "Publish parlay"}
          </Button>
          {disabledReason && !pending && <p className="text-xs text-muted">{disabledReason}</p>}
        </div>
      </form>
    </Card>
  );
}
