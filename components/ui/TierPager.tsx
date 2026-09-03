"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const navButtonClass =
  "flex h-9 w-9 shrink-0 items-center justify-center text-subtle transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

// DraftKings pages tiered lines (e.g. multiple thresholds for one player's stat) a few at a
// time with chevron arrows rather than listing every one inline -- this reproduces that
// interaction generically so both ResearchPropTable (player prop tiers) and
// ResearchAltLines (alternate spread/total lines) can share one paging behavior instead of
// each hand-rolling their own. One instance is mounted per player/side (a stable `items`
// array for its whole lifetime, since a game's odds are fetched once), so there's no need
// to reset scroll position on data change.
export function TierPager<T>({
  items,
  // 1, not 2: real bounding-box measurement (not a screenshot guess) found each tile's own
  // `min-w-[4rem]` (a hard CSS floor, not a hint flex-shrink can go below) exceeds its
  // flex-allocated half whenever two sit side by side next to both chevrons -- confirmed
  // real, measurable overlap at *both* 320px (34px) and, more surprisingly, at 375px too
  // (~7px) once the name column's own width and the tile floor had each grown since this
  // was first tuned. A single tile's floor always has room next to two chevrons, at any
  // width this app supports -- this is the version of that fix that's actually correct at
  // every breakpoint instead of two tiles that merely usually fit.
  pageSize = 1,
  keyFor,
  renderItem,
}: {
  items: T[];
  pageSize?: number;
  keyFor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const [start, setStart] = useState(0);
  const clampedStart = Math.min(start, Math.max(0, items.length - pageSize));
  const visible = items.slice(clampedStart, clampedStart + pageSize);
  const canPrev = clampedStart > 0;
  const canNext = clampedStart + pageSize < items.length;

  // Always render both chevrons (disabled when there's nothing to page to) rather than
  // switching to a chevron-less layout when items.length <= pageSize -- a real ladder
  // otherwise ends up a different width row-to-row depending on how many tiers each
  // specific player happens to have, which read as visually "mismatched" rather than one
  // consistent ladder pattern.
  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        aria-label="Previous lines"
        disabled={!canPrev}
        onClick={() => setStart(Math.max(0, clampedStart - pageSize))}
        className={navButtonClass}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      {/* No min-w-0 on these item wrappers -- each rendered tile has its own real
          min-w-[4rem] floor (see researchOddsStyles.ts), and letting the wrapper's
          own min-width default to `auto` (matching its child's real minimum) is what
          keeps the flex algorithm honest about how much space this row actually
          needs, instead of the wrapper claiming it can shrink smaller than the
          button inside it actually can -- that mismatch was rendering as the tile
          and the next chevron visually overlapping, confirmed via real
          getBoundingClientRect measurement, not just a screenshot guess. */}
      <div className="flex flex-1 gap-1.5">
        {visible.map((item) => (
          <div key={keyFor(item)} className="flex-1">
            {renderItem(item)}
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="More lines"
        disabled={!canNext}
        onClick={() => setStart(clampedStart + pageSize)}
        className={navButtonClass}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
