"use client";

import { useState, useTransition } from "react";

import { FREE_FOR_ALL_KEY, PARLAY_PRESETS } from "@/lib/parlayPresets";

import { createParlay } from "../actions";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent";

export function NewParlayForm() {
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [freeLeague, setFreeLeague] = useState("");
  const [freeLabel, setFreeLabel] = useState("");
  const [freeSingleGame, setFreeSingleGame] = useState(false);
  const [countsForRecord, setCountsForRecord] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preset = PARLAY_PRESETS.find((p) => p.key === slotKey);
  const isFreeForAll = slotKey === FREE_FOR_ALL_KEY;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const league = preset ? preset.league : freeLeague;
    const label = preset ? preset.label : freeLabel;
    const singleGame = preset ? preset.singleGame : freeSingleGame;

    startTransition(async () => {
      const result = await createParlay({ league, label, singleGame, countsForRecord });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-500">Which slot?</h2>
        <div className="flex flex-wrap gap-2">
          {PARLAY_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setSlotKey(p.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                slotKey === p.key
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSlotKey(FREE_FOR_ALL_KEY)}
            className={`rounded-full border px-3 py-1 text-xs ${
              isFreeForAll
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            }`}
          >
            Free-for-all
          </button>
        </div>
      </div>

      {isFreeForAll && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              League
              <input
                value={freeLeague}
                onChange={(e) => setFreeLeague(e.target.value)}
                placeholder="NFL, NBA, ..."
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Label (optional)
              <input
                value={freeLabel}
                onChange={(e) => setFreeLabel(e.target.value)}
                placeholder="MNF Week 2, whatever"
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={freeSingleGame}
              onChange={(e) => setFreeSingleGame(e.target.checked)}
            />
            This is just one game (skips the "pick a different game" rule)
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={countsForRecord}
          onChange={(e) => setCountsForRecord(e.target.checked)}
        />
        Counts toward the all-time record
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={pending || !slotKey || (isFreeForAll && !freeLeague.trim())}
        className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Publishing…" : "Publish parlay"}
      </button>
    </form>
  );
}
