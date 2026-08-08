"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { formatGameTime } from "@/lib/formatGameTime";
import { getScheduleGames } from "@/lib/schedule/actions";
import type { ScheduleGame } from "@/lib/schedule/types";

// Sibling to LiveOddsBrowser.tsx but deliberately much simpler -- ESPN's free scoreboard
// has no odds/lines, just real matchups, so this only ever fills in team names. Price/line
// for Free-for-all picks stays a manual field either way.
export function ScheduleBrowser({
  league,
  onSelectGame,
}: {
  league: string;
  onSelectGame: (game: { homeTeam: string; awayTeam: string; externalId: string }) => void;
}) {
  const [games, setGames] = useState<ScheduleGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
    getScheduleGames(league).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setGames(result.games);
    });
    return () => {
      cancelled = true;
    };
  }, [league]);

  if (error) {
    return <p className="text-xs text-push">{error} — type the matchup manually below.</p>;
  }
  if (games === null) {
    return <p className="text-xs text-muted">Loading schedule…</p>;
  }
  if (games.length === 0) {
    return (
      <p className="text-xs text-muted">
        No {league} games in the next 8 days — type the matchup manually below.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {games.map((game) => (
        <Card key={game.id} className="flex items-center justify-between gap-2 p-2.5">
          <p className="min-w-0 truncate text-sm">
            {game.awayTeam} <span className="text-subtle">@</span> {game.homeTeam}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-subtle">{formatGameTime(game.commenceTime)}</span>
            <button
              type="button"
              onClick={() =>
                onSelectGame({ homeTeam: game.homeTeam, awayTeam: game.awayTeam, externalId: game.id })
              }
              className="rounded-md border border-border-strong px-2.5 py-1 text-xs text-muted hover:text-foreground"
            >
              Select
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
