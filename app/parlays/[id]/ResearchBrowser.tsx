"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatGameTime } from "@/lib/formatGameTime";
import { getNflGameOdds, getNflSchedule } from "@/lib/research/actions";
import type { PropPick, ResearchGame, ResearchGameSummary, TeamBetPick } from "@/lib/research/types";

import { ResearchGameDetail } from "./ResearchGameDetail";

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

// DraftKings-style research browser for NFL, backed by lib/research/actions.ts's
// multi-provider layer -- ParlayAPI is the schedule's basis, and a specific game's odds are
// FEDERATED across ParlayAPI/SportsGameOdds/SharpAPI (merged, not just failed-over to) once
// expanded, see the plan file's Phase 2.20/2.21 sections; Phase 2.14 originally built this
// against SharpAPI alone. Two real, separate entry points, not one broad fetch: a cheap
// schedule list (real games only, no odds attached) renders immediately, and a specific
// game's full board (Game Lines + every prop category, one unified tab bar -- see
// ResearchGameDetail) is only fetched once that game is expanded, the same "browse free,
// spend on what you click" shape ScheduleBrowser/the old LiveOddsBrowser already used.
// Deliberately NOT a live-odds *entry point* on its own: every tap still lands in
// PickLegForm's normal editable slip for a final review before confirming.
export function ResearchBrowser({
  onSelectTeamBet,
  onSelectProp,
}: {
  onSelectTeamBet: (pick: TeamBetPick) => void;
  onSelectProp: (pick: PropPick) => void;
}) {
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
    return <p className="text-xs text-push">{error} — type the matchup manually below.</p>;
  }
  if (games === null) {
    return <p className="text-xs text-muted">Loading schedule…</p>;
  }
  if (games.length === 0) {
    return <p className="text-xs text-muted">No NFL odds posted right now — type the matchup manually below.</p>;
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
                    {/* One flowing text node, not two separately-boxed team-name spans --
                        splitting them each into their own 50/50 flex column produced a
                        lopsided wrap whenever only one side needed two lines (the other
                        team's name ends up clinging to line 1 with nothing below it,
                        while the wrapped side's second line sits alone). Plain inline text
                        lets the browser pick a natural break point across the whole
                        "Away @ Home" string instead. */}
                    <p className="min-w-0 flex-1 text-sm font-medium">
                      {game.awayTeam} <span className="text-subtle">@</span> {game.homeTeam}
                    </p>
                    <span className="shrink-0 text-xs text-muted">{formatGameTime(game.commenceTime)}</span>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="self-start"
                    onClick={() => toggleExpanded(game)}
                  >
                    {expanded ? "Hide odds" : "Show odds"}
                  </Button>

                  {expanded && odds === "loading" && <p className="text-xs text-muted">Loading odds…</p>}
                  {expanded && typeof odds === "string" && odds !== "loading" && (
                    <p className="text-xs text-push">{odds}</p>
                  )}
                  {expanded && odds && typeof odds === "object" && (
                    <ResearchGameDetail
                      league="NFL"
                      game={odds}
                      onSelectTeamBet={onSelectTeamBet}
                      onSelectProp={onSelectProp}
                    />
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
