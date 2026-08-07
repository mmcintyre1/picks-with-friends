"use client";

import { useActionState, useState } from "react";

import { claimPin, loginWithPin } from "./actions";

type Member = { username: string; name: string | null; claimed: boolean };

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm tracking-widest dark:border-gray-700 dark:bg-transparent";

export function LoginForm({ members }: { members: Member[] }) {
  const [selected, setSelected] = useState<Member | null>(null);

  if (!selected) {
    return (
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <button
            key={member.username}
            type="button"
            onClick={() => setSelected(member)}
            className="rounded-md border border-gray-300 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            {member.name ?? member.username}
          </button>
        ))}
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
  const [state, formAction, pending] = useActionState(
    loginWithPin.bind(null, member.username),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        Signing in as <span className="font-medium">{member.name ?? member.username}</span> —{" "}
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
        className={inputClass}
      />
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function PinClaimStep({ member, onBack }: { member: Member; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(
    claimPin.bind(null, member.username),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        First time signing in as{" "}
        <span className="font-medium">{member.name ?? member.username}</span> — choose a
        PIN. <button type="button" onClick={onBack} className="underline">not you?</button>
      </p>
      <input
        type="password"
        name="pin"
        required
        inputMode="numeric"
        maxLength={8}
        placeholder="Choose a PIN (6-8 digits)"
        autoFocus
        className={inputClass}
      />
      <input
        type="password"
        name="confirmPin"
        required
        inputMode="numeric"
        maxLength={8}
        placeholder="Confirm PIN"
        className={inputClass}
      />
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Set PIN & sign in"}
      </button>
    </form>
  );
}
