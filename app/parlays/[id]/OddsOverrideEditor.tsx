"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { SignedNumberInput } from "@/components/ui/SignedNumberInput";

import { setOddsOverride } from "../actions";

export function OddsOverrideEditor({
  parlayId,
  oddsOverride,
  hasSameGameLegs,
}: {
  parlayId: string;
  oddsOverride: number | null;
  hasSameGameLegs: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(oddsOverride?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    startTransition(async () => {
      const result = await setOddsOverride(parlayId, next);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!oddsOverride && hasSameGameLegs && (
          <span className="text-muted">
            Two of these share a game, so the combined odds above are just an estimate — enter the real number
            if you&apos;ve got it.
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setValue(oddsOverride?.toString() ?? "");
            setEditing(true);
          }}
          className="text-muted underline hover:text-foreground"
        >
          {oddsOverride != null ? "Edit odds override" : "Override odds"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-stretch divide-x divide-border overflow-hidden rounded-md border border-border bg-card">
        <SignedNumberInput
          label="Combined odds"
          value={value}
          onChange={setValue}
          placeholder="e.g. 150"
          toggleClassName="flex w-9 shrink-0 items-center justify-center bg-transparent font-display text-lg leading-none text-accent hover:bg-white/[0.05] focus:outline-none"
          inputClassName="w-24 bg-transparent px-2 py-1 text-sm text-foreground focus:outline-none"
        />
      </div>
      <Button type="button" size="sm" disabled={pending} onClick={() => save(value)}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {oddsOverride != null && (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => save("")}>
          Clear
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(false)}>
        Never mind
      </Button>
      {error && <p className="w-full text-loss">{error}</p>}
    </div>
  );
}
