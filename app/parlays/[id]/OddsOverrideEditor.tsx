"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { useIsIOS } from "@/lib/useIsIOS";

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
  // iOS's numeric keyboard has no minus key, breaking negative-odds entry -- falls back
  // to a plain keyboard there specifically, not for every platform.
  const isIOS = useIsIOS();

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
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. -150"
        autoComplete="off"
        // American odds are routinely negative -- iOS's numeric keypad has no minus key,
        // so iOS falls back to a plain keyboard; other platforms keep the numeric one.
        inputMode={isIOS ? "text" : "numeric"}
        className="w-24 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
      />
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
