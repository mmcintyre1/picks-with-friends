"use client";

import { useState } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RESEARCH_CATEGORY_LABELS, RESEARCH_CATEGORY_ORDER } from "@/lib/research/types";
import type { PropPick, ResearchGame, TeamBetPick } from "@/lib/research/types";

import { ResearchAltLines } from "./ResearchAltLines";
import { ResearchNumberedGrid } from "./ResearchNumberedGrid";
import { ResearchPropTable } from "./ResearchPropTable";
import { ResearchTeamTotals } from "./ResearchTeamTotals";

type SegmentGroupKey = "halves" | "quarters";

// Matches DraftKings' own tab structure (see the reference screenshots) -- one "Halves" tab
// and one "Quarters" tab, each with its own inner segment picker, rather than a separate
// top-level tab per segment (which was cluttering the tab bar with up to 6 entries).
const SEGMENT_GROUPS: Record<SegmentGroupKey, string[]> = {
  halves: ["1st_half", "2nd_half"],
  quarters: ["1st_quarter", "2nd_quarter", "3rd_quarter", "4th_quarter"],
};
const SEGMENT_GROUP_LABELS: Record<SegmentGroupKey, string> = { halves: "Halves", quarters: "Quarters" };
const SEGMENT_LABELS: Record<string, string> = {
  "1st_half": "1st Half",
  "2nd_half": "2nd Half",
  "1st_quarter": "1st Quarter",
  "2nd_quarter": "2nd Quarter",
  "3rd_quarter": "3rd Quarter",
  "4th_quarter": "4th Quarter",
};

type Tab =
  | { key: "game_lines"; label: string; kind: "gameLines" }
  | { key: string; label: string; kind: "segmentGroup"; group: SegmentGroupKey; availableSegments: string[] }
  | { key: string; label: string; kind: "prop" };

// Per-game deep dive: a category-tab row sourced from this specific game's real data (a
// game with no props posted just doesn't get a Passing/Receiving/Rushing tab), rendering
// ResearchNumberedGrid (+ ResearchAltLines) for Game Lines/segments and ResearchPropTable
// for prop categories.
export function ResearchGameDetail({
  league,
  game,
  onSelectTeamBet,
  onSelectProp,
}: {
  league: string;
  game: ResearchGame;
  onSelectTeamBet: (pick: TeamBetPick) => void;
  onSelectProp: (pick: PropPick) => void;
}) {
  const gameLines = game.categories.find((c) => c.key === "game_lines");
  // Sorted to a fixed DK-like order rather than left in whatever order the provider's raw
  // data happened to build ResearchGame.categories in -- see RESEARCH_CATEGORY_ORDER's comment.
  const propCategories = game.categories
    .filter((c) => c.key !== "game_lines" && c.key !== "uncategorized")
    .sort((a, b) => RESEARCH_CATEGORY_ORDER.indexOf(a.key) - RESEARCH_CATEGORY_ORDER.indexOf(b.key));

  const allSegments = [...new Set((gameLines?.marketGroups ?? []).map((g) => g.segment).filter((s): s is string => s !== null))];

  const tabs: Tab[] = [];
  if (gameLines?.marketGroups.some((g) => g.segment === null)) {
    tabs.push({ key: "game_lines", label: RESEARCH_CATEGORY_LABELS.game_lines, kind: "gameLines" });
  }
  for (const group of Object.keys(SEGMENT_GROUPS) as SegmentGroupKey[]) {
    const availableSegments = SEGMENT_GROUPS[group].filter((s) => allSegments.includes(s));
    if (availableSegments.length === 0) continue;
    tabs.push({ key: `group:${group}`, label: SEGMENT_GROUP_LABELS[group], kind: "segmentGroup", group, availableSegments });
  }
  for (const category of propCategories) {
    if (category.marketGroups.length === 0) continue;
    tabs.push({ key: category.key, label: RESEARCH_CATEGORY_LABELS[category.key], kind: "prop" });
  }

  const [activeKey, setActiveKey] = useState<string | null>(tabs[0]?.key ?? null);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  // Which specific segment is showing within each group's tab -- keyed by group so
  // switching away and back to "Quarters" remembers you were looking at the 3rd, say.
  const [selectedSegment, setSelectedSegment] = useState<Partial<Record<SegmentGroupKey, string>>>({});

  if (!active) {
    return <p className="text-xs text-muted">No odds posted for this game yet.</p>;
  }

  const currentSegment =
    active.kind === "segmentGroup" ? (selectedSegment[active.group] ?? active.availableSegments[0]) : null;

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        size="md"
        scroll
        name="Category"
        value={active.key}
        onChange={setActiveKey}
        options={tabs.map((t) => ({ value: t.key, label: t.label }))}
      />

      {(active.kind === "gameLines" || active.kind === "segmentGroup") && gameLines && (
        <>
          {/* Always shown, even with only one real segment available -- dropping this
              whenever there was nothing to toggle between used to leave "Quarters"/"Halves"
              selected with no indication of *which* quarter or half was actually being
              displayed. */}
          {active.kind === "segmentGroup" && (
            <SegmentedControl
              size="sm"
              name={SEGMENT_GROUP_LABELS[active.group]}
              value={currentSegment}
              onChange={(seg) => setSelectedSegment((prev) => ({ ...prev, [active.group]: seg }))}
              options={active.availableSegments.map((s) => ({ value: s, label: SEGMENT_LABELS[s] ?? s }))}
            />
          )}
          <ResearchNumberedGrid
            league={league}
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
            externalId={game.externalId}
            category={gameLines}
            segment={active.kind === "segmentGroup" ? currentSegment : null}
            onSelectTeamBet={onSelectTeamBet}
          />
          <ResearchTeamTotals
            league={league}
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
            externalId={game.externalId}
            category={gameLines}
            segment={active.kind === "segmentGroup" ? currentSegment : null}
            onSelectTeamBet={onSelectTeamBet}
          />
          <ResearchAltLines
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
            externalId={game.externalId}
            category={gameLines}
            segment={active.kind === "segmentGroup" ? currentSegment : null}
            onSelectTeamBet={onSelectTeamBet}
          />
        </>
      )}

      {active.kind === "prop" &&
        (() => {
          const category = propCategories.find((c) => c.key === active.key);
          return category ? (
            <ResearchPropTable
              league={league}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              externalId={game.externalId}
              category={category}
              onSelectProp={onSelectProp}
            />
          ) : null;
        })()}
    </div>
  );
}
