"use client";

import { useState, useTransition } from "react";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate } from "@/lib/formatGameTime";

import { deleteParlay } from "../parlays/actions";

function statusPill(status: ParlayStatus, result: LegResult) {
  if (status === ParlayStatus.OPEN) return <StatusPill tone="accent">Open</StatusPill>;
  if (status === ParlayStatus.LOCKED) return <StatusPill tone="pending">Awaiting evaluation</StatusPill>;
  if (status === ParlayStatus.RESOLVED) {
    return result === LegResult.WIN ? (
      <StatusPill tone="win">Won</StatusPill>
    ) : (
      <StatusPill tone="loss">Lost</StatusPill>
    );
  }
  return <StatusPill tone="muted">{status}</StatusPill>;
}

export function AdminParlayRow({
  id,
  label,
  status,
  result,
  createdAt,
  legCount,
}: {
  id: string;
  label: string;
  status: ParlayStatus;
  result: LegResult;
  createdAt: Date;
  legCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {statusPill(status, result)}
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-xs text-subtle">
          {legCount} pick{legCount === 1 ? "" : "s"} · {formatDate(createdAt)}
        </span>
      </span>
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete this parlay?">
        <p className="text-sm text-muted">
          Permanently removes it and every pick on it, including from the leaderboard if it counted toward the
          record. Can&apos;t be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Never mind
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteParlay(id);
                setOpen(false);
              })
            }
          >
            {pending ? "Deleting…" : "Yes, delete it"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
