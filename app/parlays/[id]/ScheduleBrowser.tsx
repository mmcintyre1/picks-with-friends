"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatGameTime } from "@/lib/formatGameTime";
import { teamLogoUrl } from "@/lib/rosters/leagues";
import { getScheduleGames } from "@/lib/schedule/actions";
import type { ScheduleGame } from "@/lib/schedule/types";

// Falls back to a plain initial-in-a-circle when a team name doesn't resolve to a known
// ESPN id (unlikely for schedule-seeded games, but the data's still just free text).
function TeamBadge({ league, name }: { league: string; name: string }) {
  const logo = teamLogoUrl(league, name);
  if (logo) {
    // A plain <img>, not next/image -- this is a tiny external CDN icon, not worth
    // configuring images.remotePatterns for.
    return <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" />;
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-subtle">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

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
        <Card
          key={game.id}
          className="flex flex-col gap-2 p-3 transition-colors hover:border-border-strong sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-2">
            <TeamBadge league={league} name={game.awayTeam} />
            <span className="min-w-0 truncate text-sm font-medium">{game.awayTeam}</span>
            <span className="shrink-0 text-xs text-subtle">@</span>
            <TeamBadge league={league} name={game.homeTeam} />
            <span className="min-w-0 truncate text-sm font-medium">{game.homeTeam}</span>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            <span className="font-display text-xs tracking-wide text-subtle tabular-nums">
              {formatGameTime(game.commenceTime)}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onSelectGame({ homeTeam: game.homeTeam, awayTeam: game.awayTeam, externalId: game.id })
              }
            >
              Select
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
