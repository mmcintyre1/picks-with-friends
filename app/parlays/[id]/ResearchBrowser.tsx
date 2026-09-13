"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatGameTime } from "@/lib/formatGameTime";
import { getNflGameOdds, getNflSchedule, getNflScheduleGameLines } from "@/lib/research/actions";
import type { PropPick, ResearchGame, ResearchGameSummary, TeamBetPick } from "@/lib/research/types";

import { ResearchGameDetail } from "./ResearchGameDetail";
import { ResearchNumberedGrid } from "./ResearchNumberedGrid";

// null for a real game whose kickoff time isn't confirmed yet (see ResearchGameSummary's own
// comment) -- grouped under one real "Time TBD" bucket rather than crashing on `new
// Date(null)`. The server already sorts these games last (compareCommenceTime), so this
// bucket naturally lands at the end of groupByDay's own insertion-ordered output too.
function dayLabel(iso: string | null): string {
  if (iso === null) return "Time TBD";
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
// FEDERATED across ParlayAPI/SportsGameOdds/SharpAPI (merged, not just failed-over to); Phase
// 2.14 originally built this against SharpAPI alone. Three real, separate fetches, not one
// broad call: a cheap schedule list (real games, no odds -- getNflSchedule) renders
// immediately; a whole-slate Game Lines board (Phase 2.23, getNflScheduleGameLines) is
// fetched right behind it and rendered inline per game -- real usage feedback found gating
// even Spread/Total/Moneyline behind a per-game tap made picking "a bunch of clicking" versus
// DraftKings' own home screen, which shows Game Lines for every game up front; the fuller
// per-game board (every prop category, one unified tab bar -- see ResearchGameDetail) stays
// gated behind an explicit "More props" tap, the same "browse free, spend on what you click"
// shape ScheduleBrowser/the old LiveOddsBrowser already used, since props/alt-lines are a
// real per-provider federated fetch each provider bears its own cost for. Deliberately NOT a
// live-odds *entry point* on its own: every tap still lands in PickLegForm's normal editable
// slip for a final review before confirming.
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
  // Whole-slate Game Lines, fetched once right after the schedule resolves -- null while
  // still loading (every card shows a "Loading lines…" placeholder), an empty object if the
  // fetch came back with nothing usable (every card falls back to "More props" only, exactly
  // today's behavior). Never blocks the schedule list itself from rendering.
  const [gameLinesByGame, setGameLinesByGame] = useState<Record<string, ResearchGame> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNflSchedule().then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setGames(result.games);
      getNflScheduleGameLines(result.games).then((gameLines) => {
        if (!cancelled) setGameLinesByGame(gameLines);
      });
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
              const gameLinesCategory = gameLinesByGame?.[game.externalId]?.categories.find((c) => c.key === "game_lines");
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
                    <span className="shrink-0 text-xs text-muted">{game.commenceTime ? formatGameTime(game.commenceTime) : "Time TBD"}</span>
                  </div>

                  {/* Eager, DK-style Game Lines board -- fetched once for the whole slate
                      (see getNflScheduleGameLines) rather than gated behind a per-game tap,
                      since spread/total/moneyline is "the key" market for most parlay picks.
                      Falls back to a plain note (never blocking "More props" below) once
                      loading finishes with nothing usable for this specific game. */}
                  {gameLinesByGame === null ? (
                    <p className="text-xs text-muted">Loading lines…</p>
                  ) : gameLinesCategory ? (
                    <ResearchNumberedGrid
                      league="NFL"
                      homeTeam={game.homeTeam}
                      awayTeam={game.awayTeam}
                      externalId={game.externalId}
                      category={gameLinesCategory}
                      onSelectTeamBet={onSelectTeamBet}
                    />
                  ) : (
                    <p className="text-xs text-subtle">No lines posted yet.</p>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="self-start"
                    onClick={() => toggleExpanded(game)}
                  >
                    {expanded ? "Hide props" : "More props"}
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
