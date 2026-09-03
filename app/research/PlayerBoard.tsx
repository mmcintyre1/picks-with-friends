"use client";

import { useEffect, useState } from "react";

import { PlayerHistoryPanel, PlayerNameCell } from "@/app/parlays/[id]/ResearchPropTable";
import { Card } from "@/components/ui/Card";
import { ChevronDownIcon } from "@/components/ui/icons";
import { getPlayerPropLogs } from "@/lib/playerstats/actions";
import { normalizePlayerName } from "@/lib/playerstats/gamelogStats";
import type { PlayerLogs } from "@/lib/playerstats/types";
import { computeHitRate, groupPropsByPlayer, type PlayerPropEntry } from "@/lib/research/playerBoard";
import type { ResearchGame, ResearchSelection } from "@/lib/research/types";
import { getRostersForGame } from "@/lib/rosters/actions";
import { teamAbbreviation } from "@/lib/rosters/leagues";
import { bookLabel } from "@/lib/sharpapi/categorize";
import { getTeamTrend } from "@/lib/trends/actions";
import type { TeamTrend } from "@/lib/trends/computeTrend";

type RosterInfo = { team: string; jersey: string; position: string };

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// One real tile in a horizontally-scrollable ladder strip -- unlike
// app/parlays/[id]/ResearchPropTable.tsx's TierPager (paged one tile at a time, tuned around
// real mobile-overflow bugs in a two-column name+ladder grid), this page's cards give a
// prop section the full card width, so every real tier can scroll in one continuous row
// instead of being paged -- matching the PocketProps reference the user pointed at, where
// every threshold is visible (and scrollable) at once, each with its own real hit-rate %.
function LadderTile({
  tier,
  playerName,
  propType,
  playerLogs,
  highlighted,
}: {
  tier: ResearchSelection;
  playerName: string;
  propType: string;
  playerLogs: Map<string, PlayerLogs>;
  highlighted: boolean;
}) {
  const rate = computeHitRate(playerLogs, playerName, propType, tier);
  return (
    <div
      className={`flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-center ${
        highlighted ? "border-accent bg-accent/10" : "border-border bg-card"
      }`}
    >
      <span className="rounded bg-card-elevated px-1 text-[9px] font-semibold uppercase text-subtle">{bookLabel(tier.sportsbook)}</span>
      <span className="text-xs font-bold tabular-nums text-foreground">{rate ? `${rate.pct}%` : "—"}</span>
      <span className="text-sm font-semibold tabular-nums">{tier.line}+</span>
      <span className="font-display text-xs tabular-nums text-accent">{formatPrice(tier.priceAmerican)}</span>
    </div>
  );
}

// A single Over or Under box (no real ladder -- just one main line) with the same
// percentage-first treatment as LadderTile, for a prop that only ever has one real
// threshold rather than a real tiered ladder.
function OuTile({
  label,
  selection,
  playerName,
  propType,
  playerLogs,
}: {
  label: string;
  selection: ResearchSelection;
  playerName: string;
  propType: string;
  playerLogs: Map<string, PlayerLogs>;
}) {
  const rate = computeHitRate(playerLogs, playerName, propType, selection);
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-2 text-center">
      <span className="rounded bg-card-elevated px-1 text-[9px] font-semibold uppercase text-subtle">{bookLabel(selection.sportsbook)}</span>
      <span className="text-xs font-bold tabular-nums text-foreground">{rate ? `${rate.pct}%` : "—"}</span>
      <span className="text-sm font-semibold tabular-nums">{label}</span>
      <span className="font-display text-xs tabular-nums text-accent">{formatPrice(selection.priceAmerican)}</span>
    </div>
  );
}

// The selection a player's headline % and history panel are judged against -- prefers the
// real main line (ladder's own isMainLine tier, or the main O/U's Over side) over an
// arbitrary tier, so the headline number matches what a book actually posts as *the* line,
// not just whichever tier happens to sort first.
function primarySelection(entry: PlayerPropEntry): ResearchSelection | undefined {
  if (entry.single) return entry.single;
  if (entry.ladderTiers.length > 0) return entry.ladderTiers.find((t) => t.isMainLine) ?? entry.ladderTiers[0];
  return entry.over ?? entry.under;
}

function PropSection({
  entry,
  playerName,
  playerLogs,
  opponentAbbr,
}: {
  entry: PlayerPropEntry;
  playerName: string;
  playerLogs: Map<string, PlayerLogs>;
  opponentAbbr: string | null;
}) {
  const primary = primarySelection(entry);
  const gameLog = playerLogs.get(playerName)?.logs.find((l) => l.propType === entry.propType)?.entries;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{entry.propType}</span>
      </div>

      {entry.single && (
        <OuTile label="Yes" selection={entry.single} playerName={playerName} propType={entry.propType} playerLogs={playerLogs} />
      )}

      {entry.ladderTiers.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {entry.ladderTiers.map((tier) => (
            <LadderTile
              key={tier.selectionId}
              tier={tier}
              playerName={playerName}
              propType={entry.propType}
              playerLogs={playerLogs}
              highlighted={tier.selectionId === primary?.selectionId}
            />
          ))}
        </div>
      )}

      {!entry.single && entry.ladderTiers.length === 0 && (entry.over || entry.under) && (
        <div className="flex gap-2">
          {entry.over && <OuTile label={`O ${entry.over.line}`} selection={entry.over} playerName={playerName} propType={entry.propType} playerLogs={playerLogs} />}
          {entry.under && <OuTile label={`U ${entry.under.line}`} selection={entry.under} playerName={playerName} propType={entry.propType} playerLogs={playerLogs} />}
        </div>
      )}

      {gameLog && primary && primary.line !== null && (
        <PlayerHistoryPanel entries={gameLog} line={primary.line} side={primary.side} opponentAbbr={opponentAbbr} />
      )}
    </div>
  );
}

// One player, collapsed by default to a compact header (team, jersey, name, position, and a
// headline hit-rate % from their primary prop) -- matching the PocketProps reference the
// user pointed at, where a feed of many players is scanned by that headline number first,
// then expanded to see the full ladder/history for whichever ones look interesting.
function PlayerCard({
  playerName,
  entries,
  roster,
  league,
  playerLogs,
  opponentAbbr,
}: {
  playerName: string;
  entries: PlayerPropEntry[];
  roster: RosterInfo | null;
  league: string;
  playerLogs: Map<string, PlayerLogs>;
  opponentAbbr: string | null;
}) {
  const [open, setOpen] = useState(false);

  const headlineEntry = entries.find((e) => {
    const sel = primarySelection(e);
    return sel && computeHitRate(playerLogs, playerName, e.propType, sel);
  });
  const headlineSelection = headlineEntry && primarySelection(headlineEntry);
  const headlineRate = headlineSelection ? computeHitRate(playerLogs, playerName, headlineEntry!.propType, headlineSelection) : null;

  return (
    <Card elevated className="flex flex-col gap-3 overflow-hidden p-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center justify-between gap-3 p-2.5 text-left transition-colors hover:bg-card-elevated">
        <span className="flex min-w-0 items-center gap-2">
          {roster?.jersey && <span className="shrink-0 text-xs font-semibold text-subtle">#{roster.jersey}</span>}
          <PlayerNameCell playerName={playerName} team={roster?.team ?? null} league={league} />
          {roster?.position && <span className="shrink-0 text-xs font-medium text-subtle">{roster.position}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {headlineRate && (
            <span className="text-right">
              <span className="block font-display text-lg leading-none text-foreground">{headlineRate.pct}%</span>
              <span className="block text-[10px] text-subtle">
                ({headlineRate.hits}/{headlineRate.games})
              </span>
            </span>
          )}
          <ChevronDownIcon className={`h-4 w-4 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-2.5">
          {entries.map((entry, i) => (
            <PropSection key={i} entry={entry} playerName={playerName} playerLogs={playerLogs} opponentAbbr={opponentAbbr} />
          ))}
        </div>
      )}
    </Card>
  );
}

// PocketProps-style player-first board for one game: every player who has a real prop
// posted gets their own card with ALL of their props together (across Passing/Rushing/
// Receiving/etc), instead of app/parlays/[id]/ResearchPropTable.tsx's category-first tabs
// (everyone's Receiving Yards, together). Reuses that same ladder/O-U split, hit-rate
// math, player-name/logo cell, and real-game-history panel -- this is a different
// arrangement and presentation of the same real data, not a new data source. Read-only: no
// pick wiring here, matching this phase's own scope decision (add-to-parlay from here is a
// natural later addition, not built yet).
export function PlayerBoard({
  league,
  homeTeam,
  awayTeam,
  game,
}: {
  league: string;
  homeTeam: string;
  awayTeam: string;
  game: ResearchGame;
}) {
  const boards = groupPropsByPlayer(game.categories);

  const [playerLogs, setPlayerLogs] = useState<Map<string, PlayerLogs>>(new Map());
  const [rosterByPlayer, setRosterByPlayer] = useState<Map<string, RosterInfo>>(new Map());
  const [trends, setTrends] = useState<{ home: TeamTrend | null; away: TeamTrend | null }>({ home: null, away: null });

  useEffect(() => {
    let cancelled = false;
    const requests = new Map<string, { playerName: string; propType: string }>();
    for (const board of boards) {
      for (const entry of board.entries) {
        requests.set(`${board.playerName}|${entry.propType}`, { playerName: board.playerName, propType: entry.propType });
      }
    }
    if (requests.size === 0) return;
    getPlayerPropLogs(league, homeTeam, awayTeam, [...requests.values()]).then((result) => {
      if (cancelled || "error" in result) return;
      setPlayerLogs(new Map(result.players.map((p) => [p.playerName, p])));
    });
    return () => {
      cancelled = true;
    };
    // boards is a fresh array every render derived from `game` -- keying on `game` itself
    // avoids re-fetching on every render while still refetching when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, homeTeam, awayTeam, game]);

  useEffect(() => {
    let cancelled = false;
    getRostersForGame(league, homeTeam, awayTeam).then((result) => {
      if (cancelled || "error" in result) return;
      setRosterByPlayer(
        new Map(result.players.map((p) => [normalizePlayerName(p.name), { team: p.team, jersey: p.jersey, position: p.position }])),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [league, homeTeam, awayTeam]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTeamTrend(league, homeTeam), getTeamTrend(league, awayTeam)]).then(([home, away]) => {
      if (!cancelled) setTrends({ home, away });
    });
    return () => {
      cancelled = true;
    };
  }, [league, homeTeam, awayTeam]);

  if (boards.length === 0) {
    return <p className="text-xs text-muted">No player props posted for this game yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card-elevated p-2.5 text-xs">
        <TeamTrendLine label={awayTeam} trend={trends.away} />
        <TeamTrendLine label={homeTeam} trend={trends.home} />
      </div>
      {boards.map((board) => {
        const roster = rosterByPlayer.get(normalizePlayerName(board.playerName)) ?? null;
        const opponentTeam = roster ? (roster.team === homeTeam ? awayTeam : roster.team === awayTeam ? homeTeam : null) : null;
        const opponentAbbr = opponentTeam ? teamAbbreviation(league, opponentTeam) : null;
        return (
          <PlayerCard
            key={board.playerName}
            playerName={board.playerName}
            entries={board.entries}
            roster={roster}
            league={league}
            playerLogs={playerLogs}
            opponentAbbr={opponentAbbr}
          />
        );
      })}
    </div>
  );
}

// One team's real ATS/O-U record from the free, app-owned trend database (lib/trends/) --
// starts at zero the day this shipped and only grows from real usage from here on, so a
// small/zero sample is expected for a while, not a bug. See the plan's own note on why this
// couldn't be backfilled from past seasons without paying a vendor for real historical odds.
function TeamTrendLine({ label, trend }: { label: string; trend: TeamTrend | null }) {
  if (!trend) return <span className="text-muted">{label}: loading trend…</span>;
  const { ats, ou } = trend;
  if (ats.sampleSize === 0 && ou.sampleSize === 0) {
    return <span className="text-muted">{label}: not enough tracked games yet</span>;
  }
  const parts: string[] = [];
  if (ats.sampleSize > 0) parts.push(`${ats.covers}-${ats.losses}${ats.pushes ? `-${ats.pushes}` : ""} ATS`);
  if (ou.sampleSize > 0) parts.push(`${ou.overs}-${ou.unders}${ou.pushes ? `-${ou.pushes}` : ""} O/U`);
  return (
    <span>
      <span className="font-medium text-foreground">{label}:</span> <span className="text-subtle">{parts.join(" · ")}</span>
    </span>
  );
}
