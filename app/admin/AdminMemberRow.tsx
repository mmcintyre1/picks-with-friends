"use client";

import { useState, useTransition } from "react";

import { PlayerName } from "@/components/PlayerName";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { PencilIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";

import { resetPin, unlockUser, updateFlair, updateName } from "./actions";

export function AdminMemberRow({
  userId,
  username,
  name,
  flair,
  locked,
  claimed,
}: {
  userId: string;
  username: string;
  name: string;
  flair: string | null;
  locked: boolean;
  claimed: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingFlair, setEditingFlair] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveName() {
    startTransition(async () => {
      const result = await updateName(userId, nameDraft);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setEditingName(false);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="min-w-0">
        {editingName ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-base text-foreground"
            />
            <Button type="button" size="sm" disabled={pending} onClick={saveName}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingName(false);
                setNameDraft(name);
              }}
            >
              Never mind
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <PlayerName name={name} flair={flair} className="text-lg font-medium" />
            <button
              type="button"
              title="Edit name"
              onClick={() => setEditingName(true)}
              className="rounded-md border border-border-strong p-2.5 text-muted hover:text-foreground"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <p className="text-xs text-subtle">
          @{username}
          {!claimed && " · hasn't signed in yet"}
          {locked && " · locked out"}
        </p>
        {error && <p className="mt-1 text-xs text-loss">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditingFlair((v) => !v)}>
          {editingFlair ? "Done" : "Change flair"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
          Reset PIN
        </Button>
        {locked && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await unlockUser(userId);
              })
            }
          >
            Unlock
          </Button>
        )}
      </div>

      {editingFlair && (
        <EmojiPicker
          value={flair}
          onChange={(emoji) =>
            startTransition(async () => {
              await updateFlair(userId, emoji);
              setEditingFlair(false);
            })
          }
        />
      )}

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={`Reset ${name}'s PIN?`}>
        <p className="text-sm text-muted">
          They&apos;ll be asked to choose a brand-new PIN the next time they sign in.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setResetOpen(false)}>
            Never mind
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await resetPin(userId);
                setResetOpen(false);
              })
            }
          >
            {pending ? "Resetting…" : "Yes, reset it"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
