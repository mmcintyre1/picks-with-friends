// Single source of truth for the priced-odds button/tag/label styling shared across every
// SharpAPI research grid (ResearchNumberedGrid, ResearchPropTable, ResearchAltLines,
// ResearchTeamTotals). Each of those files used to declare its own copy of these strings,
// which had already drifted (different padding, different text sizes, no width floor on
// one of them) -- that drift is exactly why ResearchTeamTotals read as a different format
// from the others. One shared definition means they can't drift again.
export const oddsCellClass =
  "relative flex w-full flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2.5 pt-3.5 pb-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10";

// A separate fragment, not baked into oddsCellClass -- ResearchNumberedGrid packs 3 of
// these into fixed `minmax(0, 1fr)` grid columns side by side (all 3 must fit a 360px
// phone at once), so forcing a min-width there risks reopening the exact overflow bug
// Phase 2.15 fixed; the other three files each host just one flexible column (a TierPager
// or an O/U pair), where a floor is safe and is what keeps a tier from getting squeezed
// illegibly thin.
export const oddsCellMinWidth = "min-w-[4rem] sm:min-w-[6rem]";

// whitespace-nowrap guards the book tag against ever wrapping onto a second line under a
// squeezed button -- harmless today (only "DK"/"FD" exist, both 2 chars) but the free-tier
// sportsbook set could grow (see categorize.ts's bookLabel comment), and this makes that a
// non-event instead of a layout bug.
export const bookTagClass = "absolute right-1 top-1 whitespace-nowrap text-[9px] leading-none text-subtle";

export const priceClass = "font-display text-base tracking-wide text-accent tabular-nums";

export const columnHeaderClass = "truncate text-center text-[10px] font-medium uppercase tracking-wide text-subtle";

// The name column's grid track for every per-player/per-side row across ResearchPropTable/
// ResearchAltLines. Real bug found via live measurement, not assumption: this used to be a
// single fixed `minmax(4.5rem, 7rem)` with no responsive variant at all, so a long name
// (e.g. "Jaxon Smith-Njigba") truncated identically at 375px and at 900px, even with
// visibly empty space next to it well before any tier button was at risk of being
// squeezed -- confirmed by measuring the rendered name box at 112px wide from 375px all
// the way to 900px viewport width. The cap now actually grows past the narrow-phone
// breakpoints where there's real room to give it.
//
// The base (below `sm:`) max was then tightened from 7rem to 5.5rem after a second real
// bug: at 320px (a genuinely real, still-common phone width, not covered by the 360-390px
// range this app's overflow work had verified until now), a `minmax(4.5rem, 7rem)` track
// grows toward its 7rem ceiling regardless of how little room TierPager's own chevrons/
// tiles have left, and unlike the name column, those have real fixed pixel minimums that
// don't shrink -- confirmed via a real click failure ("element ... intercepts pointer
// events") where a tier tile's box was overlapping the chevron button's box. Names can
// safely give up some of that base-case ceiling now that they wrap instead of truncating
// (Phase 2.18's second follow-up) -- a name that doesn't fit in 5.5rem just wraps to an
// extra line instead of squeezing TierPager, whereas TierPager's tap targets have nowhere
// left to shrink to.
export const nameGridCols = "grid-cols-[minmax(4rem,4.5rem)_1fr] sm:grid-cols-[minmax(4.5rem,11rem)_1fr] lg:grid-cols-[minmax(4.5rem,16rem)_1fr]";
export const nameGridColsOU =
  "grid-cols-[minmax(4rem,4.5rem)_1fr_1fr] sm:grid-cols-[minmax(4.5rem,11rem)_1fr_1fr] lg:grid-cols-[minmax(4.5rem,16rem)_1fr_1fr]";
