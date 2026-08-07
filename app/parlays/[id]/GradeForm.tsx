"use client";

import { useState, useTransition } from "react";

import { LegResult } from "@/app/generated/prisma/enums";

import { gradeParlay } from "../actions";

type Leg = { id: string; userName: string; summary: string };

export function GradeForm({ parlayId, legs }: { parlayId: string; legs: Leg[] }) {
  const [results, setResults] = useState<Record<string, LegResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await gradeParlay(parlayId, results);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-md border border-gray-300 p-4 dark:border-gray-700"
    >
      <h2 className="text-sm font-medium">Grade this parlay</h2>
      {legs.map((leg) => (
        <div key={leg.id} className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">{leg.userName}</p>
            <p className="text-xs text-gray-500">{leg.summary}</p>
          </div>
          <select
            value={results[leg.id] ?? ""}
            onChange={(e) => setResults((r) => ({ ...r, [leg.id]: e.target.value as LegResult }))}
            required
            className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-transparent"
          >
            <option value="" disabled>
              Result
            </option>
            <option value={LegResult.WIN}>Win</option>
            <option value={LegResult.LOSS}>Loss</option>
            <option value={LegResult.PUSH}>Push</option>
          </select>
        </div>
      ))}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Submit grades"}
      </button>
    </form>
  );
}
