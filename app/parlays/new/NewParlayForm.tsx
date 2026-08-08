"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { FREE_FOR_ALL_KEY, PARLAY_PRESETS } from "@/lib/parlayPresets";

import { createParlay } from "../actions";

const inputClass = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle";

const slotCardClass = (active: boolean) =>
  `flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
    active ? "border-accent bg-accent/10" : "border-border bg-card hover:border-border-strong"
  }`;

export function NewParlayForm() {
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [freeLeague, setFreeLeague] = useState("");
  const [freeLabel, setFreeLabel] = useState("");
  const [countsForRecord, setCountsForRecord] = useState(true);
  const [stake, setStake] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preset = PARLAY_PRESETS.find((p) => p.key === slotKey);
  const isFreeForAll = slotKey === FREE_FOR_ALL_KEY;

  const disabledReason = !slotKey
    ? "Pick a slot to continue."
    : isFreeForAll && !freeLeague.trim()
      ? "Enter a league for Free-for-all."
      : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const league = preset ? preset.league : freeLeague;
    const label = preset ? preset.label : freeLabel;

    startTransition(async () => {
      const result = await createParlay({ league, label, isFreeForAll, countsForRecord, stake });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Which slot?</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PARLAY_PRESETS.map((p) => {
            const active = slotKey === p.key;
            return (
              <button key={p.key} type="button" onClick={() => setSlotKey(p.key)} className={slotCardClass(active)}>
                <span className="text-sm font-medium">{p.label}</span>
                <span className={`text-xs ${active ? "text-accent" : "text-transparent"}`}>✓ Selected</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setSlotKey(FREE_FOR_ALL_KEY)} className={slotCardClass(isFreeForAll)}>
            <span className="text-sm font-medium">Free-for-all</span>
            <span className={`text-xs ${isFreeForAll ? "text-accent" : "text-transparent"}`}>✓ Selected</span>
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-200 ease-out ${isFreeForAll ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
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
          <p className="text-xs text-subtle">
            Each pick in a Free-for-all parlay can be its own sport (NBA, MLB, NHL, or anything else) -- this
            League field is just a label for the parlay, not a restriction.
          </p>
        </div>
      </div>

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

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={countsForRecord}
          onChange={(e) => setCountsForRecord(e.target.checked)}
        />
        Counts toward the all-time record
      </label>

      {error && <p className="text-sm text-loss">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || Boolean(disabledReason)}>
          {pending ? "Publishing…" : "Publish parlay"}
        </Button>
        {disabledReason && !pending && <p className="text-xs text-muted">{disabledReason}</p>}
      </div>
    </form>
  );
}
