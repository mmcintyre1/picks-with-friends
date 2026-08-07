"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { claimPin, loginWithPin } from "./actions";

type Member = { username: string; name: string | null; claimed: boolean };

const pinInputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-3 text-center text-2xl tracking-[0.5em] text-foreground placeholder:text-sm placeholder:tracking-normal placeholder:text-subtle";

function initials(label: string): string {
  return label.trim().slice(0, 2).toUpperCase();
}

export function LoginForm({ members }: { members: Member[] }) {
  const [selected, setSelected] = useState<Member | null>(null);

  if (!selected) {
    return (
      <div className="flex flex-col gap-2">
        {members.map((member) => {
          const label = member.name ?? member.username;
          return (
            <button key={member.username} type="button" onClick={() => setSelected(member)} className="text-left">
              <Card className="flex items-center gap-3 p-3 transition-colors hover:border-border-strong">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {initials(label)}
                </span>
                <span className="text-sm font-medium">{label}</span>
              </Card>
            </button>
          );
        })}
      </div>
    );
  }

  return selected.claimed ? (
    <PinLoginStep member={selected} onBack={() => setSelected(null)} />
  ) : (
    <PinClaimStep member={selected} onBack={() => setSelected(null)} />
  );
}

function PinLoginStep({ member, onBack }: { member: Member; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(loginWithPin.bind(null, member.username), null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Signing in as <span className="font-medium text-foreground">{member.name ?? member.username}</span> —{" "}
        <button type="button" onClick={onBack} className="underline">
          not you?
        </button>
      </p>
      <input
        type="password"
        name="pin"
        required
        inputMode="numeric"
        maxLength={8}
        placeholder="PIN"
        autoFocus
        className={pinInputClass}
      />
      {state?.error && <p className="text-sm text-loss">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function PinClaimStep({ member, onBack }: { member: Member; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(claimPin.bind(null, member.username), null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        First time signing in as <span className="font-medium text-foreground">{member.name ?? member.username}</span> —
        choose a PIN.{" "}
        <button type="button" onClick={onBack} className="underline">
          not you?
        </button>
      </p>
      <input
        type="password"
        name="pin"
        required
        inputMode="numeric"
        maxLength={8}
        placeholder="Choose a PIN (6-8 digits)"
        autoFocus
        className={pinInputClass}
      />
      <input
        type="password"
        name="confirmPin"
        required
        inputMode="numeric"
        maxLength={8}
        placeholder="Confirm PIN"
        className={pinInputClass}
      />
      {state?.error && <p className="text-sm text-loss">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set PIN & sign in"}
      </Button>
    </form>
  );
}
