"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatGameTime } from "@/lib/formatGameTime";
import { getNflGameOdds, getNflSchedule } from "@/lib/research/actions";
import type { ResearchGame, ResearchGameSummary } from "@/lib/research/types";

import { PlayerBoard } from "./PlayerBoard";

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function groupByDay(games: ResearchGameSummary[]): { label: string; games: ResearchGameSummary[] }[] {
  const groups = new Map<string, ResearchGameSummary[]>();
  for (const game of games) {
    const label = dayLabel(game.commenceTime);
    const list = groups.get(label) ?? [];
    list.push(game);
    groups.set(label, list);
  }
  return [...groups.entries()].map(([label, games]) => ({ label, games }));
}

type OddsState = "loading" | ResearchGame | string; // string = error message

// Player-first sibling of app/parlays/[id]/ResearchBrowser.tsx -- same schedule-then-drill-in
// shape (cheap schedule list, a specific game's federated odds only fetched once expanded,
// same 15-minute durable cache underneath via lib/research/actions.ts), but read-only: no
// onSelectTeamBet/onSelectProp wiring, since this page is for browsing/research, not picking
// a leg. Renders PlayerBoard (grouped by player) instead of ResearchGameDetail (grouped by
// category) once a game is expanded.
export function PlayerResearchBrowser() {
  const [games, setGames] = useState<ResearchGameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [oddsById, setOddsById] = useState<Record<string, OddsState>>({});

  useEffect(() => {
    let cancelled = false;
    getNflSchedule().then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setGames(result.games);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleExpanded(game: ResearchGameSummary) {
    if (expandedId === game.externalId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(game.externalId);
    if (oddsById[game.externalId]) return;
    setOddsById((prev) => ({ ...prev, [game.externalId]: "loading" }));
    const result = await getNflGameOdds(game.externalId, game.source, game.homeTeam, game.awayTeam);
    setOddsById((prev) => ({ ...prev, [game.externalId]: "error" in result ? result.error : result.game }));
  }

  if (error) {
    return <p className="text-xs text-push">{error}</p>;
  }
  if (games === null) {
    return <p className="text-xs text-muted">Loading schedule…</p>;
  }
  if (games.length === 0) {
    return <p className="text-xs text-muted">No NFL odds posted right now.</p>;
  }

  const groups = groupByDay(games);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">{group.label}</p>
          <div className="flex flex-col gap-2">
            {group.games.map((game) => {
              const expanded = expandedId === game.externalId;
              const odds = oddsById[game.externalId];
              return (
                <Card key={game.externalId} className="flex flex-col gap-2 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium">
                      {game.awayTeam} <span className="text-subtle">@</span> {game.homeTeam}
                    </p>
                    <span className="shrink-0 text-xs text-muted">{formatGameTime(game.commenceTime)}</span>
                  </div>

                  <Button type="button" variant="secondary" size="md" className="self-start" onClick={() => toggleExpanded(game)}>
                    {expanded ? "Hide players" : "Show players"}
                  </Button>

                  {expanded && odds === "loading" && <p className="text-xs text-muted">Loading odds…</p>}
                  {expanded && typeof odds === "string" && odds !== "loading" && <p className="text-xs text-push">{odds}</p>}
                  {expanded && odds && typeof odds === "object" && (
                    <PlayerBoard league="NFL" homeTeam={game.homeTeam} awayTeam={game.awayTeam} game={odds} />
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
