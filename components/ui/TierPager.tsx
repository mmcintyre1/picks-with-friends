"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const navButtonClass =
  "flex h-8 w-6 shrink-0 items-center justify-center text-subtle transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

// DraftKings pages tiered lines (e.g. multiple thresholds for one player's stat) a few at a
// time with chevron arrows rather than listing every one inline -- this reproduces that
// interaction generically so both ResearchPropTable (player prop tiers) and
// ResearchAltLines (alternate spread/total lines) can share one paging behavior instead of
// each hand-rolling their own. One instance is mounted per player/side (a stable `items`
// array for its whole lifetime, since a game's odds are fetched once), so there's no need
// to reset scroll position on data change.
export function TierPager<T>({
  items,
  pageSize = 3,
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

  if (items.length <= pageSize) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <div key={keyFor(item)}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous lines"
        disabled={!canPrev}
        onClick={() => setStart(Math.max(0, clampedStart - pageSize))}
        className={navButtonClass}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
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
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
