"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";

import { evaluateParlay } from "../actions";
import type { EvaluateOutcome } from "../actions";

// Mirrors the server's own cooldown (app/parlays/actions.ts's EVALUATE_COOLDOWN_MS) --
// this is purely cosmetic (greys the button out instead of round-tripping into a server
// error on every extra click), the server enforces the real one regardless.
const COOLDOWN_MS = 20_000;

export function EvaluateButton({
  parlayId,
  lastEvaluatedAt,
  onOutcome,
}: {
  parlayId: string;
  lastEvaluatedAt: Date | null;
  onOutcome: (outcome: EvaluateOutcome) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(
    lastEvaluatedAt ? lastEvaluatedAt.getTime() + COOLDOWN_MS : null,
  );
  const [now, setNow] = useState(() => Date.now());

  const onCooldown = cooldownUntil !== null && now < cooldownUntil;

  // Tick once a second while on cooldown so the button re-enables itself without needing
  // another click to notice time has passed.
  useEffect(() => {
    if (!onCooldown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [onCooldown]);

  function evaluate() {
    setError(null);
    startTransition(async () => {
      const result = await evaluateParlay(parlayId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      setNow(Date.now());
      onOutcome(result);
    });
  }

  const secondsLeft = onCooldown && cooldownUntil ? Math.ceil((cooldownUntil - now) / 1000) : 0;

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" size="sm" disabled={pending || onCooldown} onClick={evaluate}>
        {pending ? "Checking ESPN…" : onCooldown ? `Check again in ${secondsLeft}s` : "Evaluate against ESPN"}
      </Button>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
