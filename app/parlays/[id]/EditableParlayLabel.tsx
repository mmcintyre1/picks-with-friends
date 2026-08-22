"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { PencilIcon } from "@/components/ui/icons";

import { setWindowLabel } from "../actions";

// Same inline-edit pattern as AdminMemberRow's name field: a pencil toggles a plain
// heading into an input + Save/Never mind, no modal needed since this is purely cosmetic
// and easily correctable.
export function EditableParlayLabel({
  parlayId,
  label,
  league,
}: {
  parlayId: string;
  label: string | null;
  league: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setWindowLabel(parlayId, draft);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={league}
            autoFocus
            autoComplete="off"
            className="rounded-lg border border-border bg-card px-2 py-1 font-display text-xl tracking-wide text-foreground"
          />
          <Button type="button" size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setDraft(label ?? "");
              setError(null);
            }}
          >
            Never mind
          </Button>
        </div>
        {error && <p className="text-xs text-loss">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <h1 className="font-display text-2xl tracking-wide">{label ?? league}</h1>
      <button
        type="button"
        title="Edit label"
        onClick={() => setEditing(true)}
        className="rounded-md p-1.5 text-muted opacity-70 transition hover:bg-white/5 hover:text-foreground hover:opacity-100"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
