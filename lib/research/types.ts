import type { Market, Side, TeamSide } from "@/app/generated/prisma/enums";

// Shared, vendor-agnostic shapes for the NFL research browser -- originally lived in
// lib/sharpapi/types.ts (the only provider that existed then), relocated here once a second
// real provider (lib/sportsgameodds/) needed to produce the exact same shape. Nothing here
// is specific to either vendor's raw response format; each provider's own categorize.ts is
// responsible for transforming its real data into these types.

// Which provider actually supplied a given game -- internal plumbing for lib/research/
// actions.ts's fallback routing (a game's externalId is only meaningful to the provider
// that issued it), not surfaced in the UI. A friend picking a leg doesn't need to know
// which backend vendor served it, the same way per-selection book attribution (not
// per-provider) is already how sportsbook identity is shown.
export type ResearchProviderSource = "sharpapi" | "sportsgameodds" | "parlayapi";

export type ResearchGameSummary = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  source: ResearchProviderSource;
};

// The DraftKings-style category tabs this browser groups markets into. "uncategorized" is
// an explicit escape hatch for a real market_type/statID neither provider's categorize.ts
// recognizes yet -- routed there deliberately (and filtered out of the tab bar entirely by
// ResearchGameDetail.tsx) rather than guessed into a bucket that doesn't fit.
export type ResearchCategoryKey =
  | "game_lines"
  | "td_scorers"
  | "passing"
  | "receiving"
  | "rushing"
  | "kicking"
  | "defense"
  | "uncategorized";

export const RESEARCH_CATEGORY_LABELS: Record<ResearchCategoryKey, string> = {
  game_lines: "Game Lines",
  td_scorers: "TD Scorers",
  passing: "Passing",
  rushing: "Rushing",
  receiving: "Receiving",
  kicking: "Kicking",
  defense: "Defense",
  uncategorized: "More",
};

// Fixed DK-like tab order for the prop-category tab bar (see
// app/parlays/[id]/ResearchGameDetail.tsx) -- object key order alone isn't reliable for
// this, since a provider's categorize.ts builds ResearchGame.categories in whatever order
// its own raw data happened to iterate in, not this declared order. Game Lines/segment tabs
// are handled separately and never read this list.
export const RESEARCH_CATEGORY_ORDER: ResearchCategoryKey[] = [
  "passing",
  "rushing",
  "receiving",
  "td_scorers",
  "kicking",
  "defense",
];

export type ResearchSelection = {
  selectionId: string;
  selection: string; // display text as the vendor sent it
  line: number | null;
  priceAmerican: number;
  side: Side;
  playerName: string | null;
  // Real fetches confirmed different vendors (and different books within one vendor) carry
  // meaningfully different market coverage for the same real game -- surfaced per-selection
  // so the UI can label which book a given price actually came from instead of implying
  // it's all one book.
  sportsbook: string;
  isMainLine: boolean;
  // Which team this selection's total belongs to -- only meaningful for team_total rows,
  // null for every other market.
  teamSide: TeamSide | null;
};

export type ResearchMarketGroup = {
  marketType: string; // base market type, segment prefix/period already stripped
  segment: string | null; // e.g. "1st_half", null for full game
  selections: ResearchSelection[];
};

export type ResearchCategory = {
  key: ResearchCategoryKey;
  marketGroups: ResearchMarketGroup[];
};

export type ResearchGame = {
  externalId: string; // the supplying provider's own event id
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  categories: ResearchCategory[];
};

// Reused by ResearchBrowser/ResearchGameDetail/ResearchPropTable to hand a tapped selection
// back up to PickLegForm -- deliberately the same shape LiveOddsBrowser.tsx already defined
// for the same purpose (dormant, untouched on purpose), so PickLegForm's setSlip wiring
// needs no new type, just a new source.
export type TeamBetPick = {
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  line: number | null;
  price: number;
  externalId: string;
  // Only present for TEAM_TOTAL picks -- which team the total belongs to.
  teamSide?: TeamSide;
};

export type PropPick = TeamBetPick & { playerName: string; propType: string };
