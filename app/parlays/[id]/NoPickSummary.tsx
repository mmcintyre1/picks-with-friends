import { Fragment } from "react";

import { PlayerName } from "@/components/PlayerName";

// A single compact line instead of one full LegRow card per person with no pick --
// several near-empty "No pick yet" cards stacked up (the common case right after a
// parlay's created) was the biggest source of wasted vertical space on this page.
export function NoPickSummary({
  label,
  members,
}: {
  label: string;
  members: { userId: string; name: string; flair?: string | null }[];
}) {
  if (members.length === 0) return null;

  return (
    <p className="px-1 text-sm text-subtle">
      {label}{" "}
      {members.map((m, i) => (
        <Fragment key={m.userId}>
          <PlayerName name={m.name} flair={m.flair} className="text-foreground" />
          {i < members.length - 1 && ", "}
        </Fragment>
      ))}
    </p>
  );
}
