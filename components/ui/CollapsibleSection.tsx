"use client";

import { useState, type ReactNode } from "react";

import { Card } from "./Card";
import { ChevronDownIcon } from "./icons";

// DraftKings' own board starts every prop/alt-line section collapsed and lets you open just
// the ones you care about, rather than dumping every category's full data open at once.
// The whole section (header + its expanded content) is one Card, matching DK's own
// nested-card look -- a section card containing player cards containing the bet buttons
// themselves, not a bare list under a plain header.
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-3 py-3 text-left transition-colors hover:bg-card-elevated"
      >
        <span className="font-display text-base tracking-wide text-foreground">{title}</span>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="flex flex-col gap-2 border-t border-border p-2">{children}</div>}
    </Card>
  );
}
