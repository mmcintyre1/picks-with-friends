"use client";

import Image from "next/image";
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
    return <Image src={logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />;
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[9px] font-semibold text-subtle">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// Sibling to LiveOddsBrowser.tsx but deliberately much simpler -- ESPN's free scoreboard
// has no odds/lines, just real matchups, so this only ever fills in team names. Price/line
// stays a manual field either way.
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
    // Resetting to a loading state before the fetch below is the standard React
    // race-condition-safe data-fetching shape (matches the `cancelled` guard pattern) --
    // the lint rule's concern (an extra render pass) is an acceptable tradeoff here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          className="flex flex-col gap-1.5 p-2.5 transition-colors hover:border-border-strong sm:flex-row sm:items-center sm:justify-between"
        >
          {/* flex-wrap, not two fixed 50/50 columns -- forcing each team name into its own
              equal-width box produced a lopsided wrap whenever only one side needed two
              lines (the other name clings to line 1 with nothing below it). Letting the
              badge+name+"@"+badge+name sequence wrap as whole chunks breaks at a natural
              boundary (after "@", between a badge and the next name) instead of splitting
              either name in isolation. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="flex items-center gap-1.5">
              <TeamBadge league={league} name={game.awayTeam} />
              <span className="text-sm font-medium">{game.awayTeam}</span>
            </span>
            <span className="text-xs text-subtle">@</span>
            <span className="flex items-center gap-1.5">
              <TeamBadge league={league} name={game.homeTeam} />
              <span className="text-sm font-medium">{game.homeTeam}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
            <span className="font-display text-xs tracking-wide text-subtle tabular-nums">
              {formatGameTime(game.commenceTime)}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="md"
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
