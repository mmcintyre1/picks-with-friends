"use client";

import { useEffect, useState } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { ChevronDownIcon } from "@/components/ui/icons";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { HitRateDots } from "@/components/ui/HitRateDots";
import { TierPager } from "@/components/ui/TierPager";
import { getPlayerPropLogs } from "@/lib/playerstats/actions";
import { average, filterByOpponent, hitRate, isHit, type HitRate } from "@/lib/playerstats/gamelogStats";
import type { GameLogEntry, PlayerLogs } from "@/lib/playerstats/types";
import { getRostersForGame } from "@/lib/rosters/actions";
import { teamAbbreviation, teamLogoUrl } from "@/lib/rosters/leagues";
import type { ResearchCategory, ResearchSelection, PropPick } from "@/lib/research/types";
import { bookLabel, propTypeLabel } from "@/lib/sharpapi/categorize";

import { bookTagClass, nameGridCols, nameGridColsOU, oddsCellClass, oddsCellMinWidth, priceClass } from "./researchOddsStyles";
import { TeamAvatar } from "./TeamMarketGrid";

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// A null line means a single-outcome "will this player do X" market (confirmed real: first/
// last touchdown scorer) -- selection.selection there just repeats the player's own name,
// which is redundant with the row header already showing it, so show "Yes" instead.
function sideLabel(selection: ResearchSelection): string {
  if (selection.line === null) return "Yes";
  return selection.selection || "Bet";
}

function buildPick(
  selection: ResearchSelection,
  playerName: string,
  propType: string,
  homeTeam: string,
  awayTeam: string,
  externalId: string,
): PropPick {
  return {
    homeTeam,
    awayTeam,
    // A null line (first/last touchdown scorer) is a genuine yes/no prop, not an
    // over/under one -- same distinction manual entry makes via the Prop shape toggle.
    market: selection.line === null ? Market.PLAYER_PROP_YESNO : Market.PLAYER_PROP,
    side: selection.side,
    line: selection.line,
    price: selection.priceAmerican,
    externalId,
    playerName,
    propType,
  };
}

const tierButtonClass = `${oddsCellClass} ${oddsCellMinWidth}`;

const ouColumnsClass = `grid ${nameGridColsOU} items-center gap-2`;

// Matches the "L10" convention PocketProps' own screenshots used -- last 10 real games, or
// fewer if the player doesn't have 10 yet (a rookie's first month, e.g.), never padded out
// with anything that isn't a real logged game.
const HIT_RATE_GAMES = 10;

// A single-outcome market's real numeric line is always reported as 0 by every vendor this
// app pulls from (confirmed real for both ParlayAPI and SportsGameOdds' Anytime TD rows) --
// but "0" isn't the real betting threshold, it's a placeholder for "did this happen at all,"
// i.e. at least one occurrence. Feeding a real 0 into the hit-rate math would make every
// non-negative stat "hit" 100% of the time, which is meaningless. categorize.ts already
// drops that placeholder (selection.line is null for these), so null is treated as "1" here
// -- the real intent of a yes/no counting stat -- rather than re-deriving it from the raw 0.
function effectiveLine(selection: ResearchSelection): number {
  return selection.line ?? 1;
}

function computeHitRate(
  logsByPlayer: Map<string, PlayerLogs>,
  playerName: string,
  propType: string,
  selection: ResearchSelection,
): HitRate | null {
  const entries = logsByPlayer.get(playerName)?.logs.find((l) => l.propType === propType)?.entries;
  if (!entries) return null;
  return hitRate(entries, effectiveLine(selection), selection.side, HIT_RATE_GAMES);
}

// Thin wrapper so every call site can just render this inline instead of repeating the
// null-check dance around computeHitRate -- renders nothing when there's no real history.
function PropHitRateDots({
  logsByPlayer,
  playerName,
  propType,
  selection,
}: {
  logsByPlayer: Map<string, PlayerLogs>;
  playerName: string;
  propType: string;
  selection: ResearchSelection;
}) {
  const rate = computeHitRate(logsByPlayer, playerName, propType, selection);
  return rate ? <HitRateDots rate={rate} /> : null;
}

// A player's own team logo (circular, or an initial-letter fallback) to the left of their
// name -- resolved via the same roster lookup PlayerPropPicker/PickLegForm already use for
// manual prop entry, not a new data source. A roster-lookup miss (name mismatch) just
// leaves `team` null and falls back to TeamAvatar's own initial-circle treatment using the
// player's own initial instead of a team's -- never a crash, never a guess.
//
// Wraps onto a second line rather than truncating -- on a narrow phone there's no spare
// horizontal room to give a long name (e.g. "Jaxon Smith-Njigba"), but there's always
// vertical room, since each row's own height is free to grow. No `truncate`/`whitespace-
// nowrap` here at all: a name that fits stays on one line on its own: only one that doesn't
// wraps, at any viewport width.
function PlayerNameCell({ playerName, team, league }: { playerName: string; team: string | null; league: string }) {
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <span className="mt-0.5">
        <TeamAvatar logo={team ? teamLogoUrl(league, team) : null} name={team ?? playerName} />
      </span>
      <span className="min-w-0 text-sm font-medium">{playerName}</span>
    </span>
  );
}

// "9/28" style, from the game's own real ISO date -- UTC components deliberately, not the
// viewer's local timezone, so a late-kickoff game can't render as the following calendar
// day for someone west of it. This is display-only context, not the game's own scheduling
// data (formatGameTime.ts already owns that, with its own real timezone handling).
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// One real past game: opponent (with "@" for a road game, matching the PocketProps
// reference screenshot's own convention), the actual stat value in a colored box (green/red
// against the bet's own line, the same real isHit rule the dot-strip above already uses --
// not the section's average), and the date.
function StatBox({ entry, line, side }: { entry: GameLogEntry; line: number; side: Side }) {
  const hit = isHit(entry.value, line, side);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className="text-[9px] text-subtle">{entry.isHome ? entry.opponent : `@${entry.opponent}`}</span>
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold tabular-nums ${hit ? "bg-win text-win-foreground" : "bg-loss text-loss-foreground"}`}
      >
        {entry.value}
      </span>
      <span className="text-[9px] text-subtle">{formatShortDate(entry.date)}</span>
    </div>
  );
}

// One horizontally-scrollable strip of real games -- "Last 10" or "vs SEA" -- with its own
// real average and hit count. Renders nothing for an empty list (a brand-new opponent
// matchup with zero real history) rather than an empty, confusing section.
function HistorySection({ title, entries, line, side }: { title: string; entries: GameLogEntry[]; line: number; side: Side }) {
  if (entries.length === 0) return null;
  const hits = entries.filter((e) => isHit(e.value, line, side)).length;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {title} <span className="font-normal text-subtle">AVG {average(entries)}</span>
        </span>
        <span className="text-xs font-medium text-subtle">
          {hits}/{entries.length}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <StatBox key={entry.eventId} entry={entry} line={line} side={side} />
        ))}
      </div>
    </div>
  );
}

// The real player-breakout panel -- Last N games plus real history against THIS specific
// opponent (the other team in the game being browsed, not a future opponent -- there's only
// ever one real matchup in view here), reproducing the reference screenshot's own layout.
// `opponentAbbr` is null when the player's own team couldn't be resolved (a roster-name
// mismatch) -- the Last-N section still renders on its own rather than losing everything.
function PlayerHistoryPanel({
  entries,
  line,
  side,
  opponentAbbr,
}: {
  entries: GameLogEntry[];
  line: number;
  side: Side;
  opponentAbbr: string | null;
}) {
  const last = entries.slice(0, HIT_RATE_GAMES);
  if (last.length === 0) return null;
  const vsOpponent = opponentAbbr ? filterByOpponent(entries, opponentAbbr) : [];

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-2 sm:flex-row sm:gap-4">
      <HistorySection title={`Last ${last.length}`} entries={last} line={line} side={side} />
      {opponentAbbr && <HistorySection title={`vs ${opponentAbbr}`} entries={vsOpponent} line={line} side={side} />}
    </div>
  );
}

// One player's O/U row, made expandable: tapping the name reveals PlayerHistoryPanel below
// the whole row (spanning both Over and Under) rather than duplicating it per side -- the
// two sides share the exact same real game log, just read from opposite ends of the same
// line, so one panel colored against whichever side actually has a real line (Over,
// preferring it when both exist, purely because that's the side shown first) covers both.
function PropOuRow({
  playerName,
  team,
  league,
  homeTeam,
  awayTeam,
  over,
  under,
  label,
  logsByPlayer,
  externalId,
  onSelectProp,
}: {
  playerName: string;
  team: string | null;
  league: string;
  homeTeam: string;
  awayTeam: string;
  over: ResearchSelection | undefined;
  under: ResearchSelection | undefined;
  label: string;
  logsByPlayer: Map<string, PlayerLogs>;
  externalId: string;
  onSelectProp: (pick: PropPick) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = logsByPlayer.get(playerName)?.logs.find((l) => l.propType === label)?.entries;
  const primary = over ?? under;
  const opponentTeam = team ? (team === homeTeam ? awayTeam : team === awayTeam ? homeTeam : null) : null;
  const opponentAbbr = opponentTeam ? teamAbbreviation(league, opponentTeam) : null;
  const canExpand = Boolean(entries && entries.length > 0 && primary?.line !== null && primary?.line !== undefined);

  return (
    <Card elevated className="flex flex-col gap-2 p-2">
      <div className={ouColumnsClass}>
        <button
          type="button"
          className="flex min-w-0 items-center gap-1 text-left disabled:cursor-default"
          disabled={!canExpand}
          onClick={() => setExpanded((e) => !e)}
        >
          <PlayerNameCell playerName={playerName} team={team} league={league} />
          {canExpand && (
            <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-subtle transition-transform ${expanded ? "rotate-180" : ""}`} />
          )}
        </button>
        {over ? (
          <button type="button" className={tierButtonClass} onClick={() => onSelectProp(buildPick(over, playerName, label, homeTeam, awayTeam, externalId))}>
            <span className={bookTagClass}>{bookLabel(over.sportsbook)}</span>
            <span>O {over.line}</span>
            <span className={priceClass}>{formatPrice(over.priceAmerican)}</span>
            <PropHitRateDots logsByPlayer={logsByPlayer} playerName={playerName} propType={label} selection={over} />
          </button>
        ) : (
          <span />
        )}
        {under ? (
          <button type="button" className={tierButtonClass} onClick={() => onSelectProp(buildPick(under, playerName, label, homeTeam, awayTeam, externalId))}>
            <span className={bookTagClass}>{bookLabel(under.sportsbook)}</span>
            <span>U {under.line}</span>
            <span className={priceClass}>{formatPrice(under.priceAmerican)}</span>
            <PropHitRateDots logsByPlayer={logsByPlayer} playerName={playerName} propType={label} selection={under} />
          </button>
        ) : (
          <span />
        )}
      </div>
      {expanded && entries && primary?.line !== null && primary?.line !== undefined && (
        <PlayerHistoryPanel entries={entries} line={primary.line} side={primary.side} opponentAbbr={opponentAbbr} />
      )}
    </Card>
  );
}

// One row per player per stat -- DK distinguishes a pure tiered "ladder" (increasing Over
// thresholds only, paged a few at a time, e.g. "227+ / 230+ / 240+") from a separate,
// compact "<Stat> O/U" table showing just the single main line's Over and Under side by
// side. Splitting these (rather than one paged list mixing Over and Under of the same line
// together, which is what this looked like before) is what actually reproduces DK's real
// layout -- confirmed against the real reference screenshots.
export function ResearchPropTable({
  league,
  homeTeam,
  awayTeam,
  externalId,
  category,
  onSelectProp,
}: {
  league: string;
  homeTeam: string;
  awayTeam: string;
  externalId: string;
  category: ResearchCategory;
  onSelectProp: (pick: PropPick) => void;
}) {
  // Resolves which team each player belongs to, purely for the logo avatar -- the SharpAPI
  // prop rows themselves carry no team field (only team_total rows do). Reuses the same
  // roster action PlayerPropPicker already fetches from for manual entry, so this costs no
  // new network surface, just a second consumer of an already-cached (6h) roster fetch.
  const [teamByPlayer, setTeamByPlayer] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getRostersForGame(league, homeTeam, awayTeam).then((result) => {
      if (cancelled || "error" in result) return;
      setTeamByPlayer(new Map(result.players.map((p) => [p.name, p.team])));
    });
    return () => {
      cancelled = true;
    };
  }, [league, homeTeam, awayTeam]);

  const groups = category.marketGroups.filter((g) => g.segment === null);

  // Real recent-game history, PocketProps-style ("has this line actually hit lately") --
  // fetched once for every (player, stat) this category is about to render, not per line/
  // tier, since a 10-tier ladder is the exact same real game log judged against ten
  // different numbers. A miss here (unmatched player, unsupported league/propType) just
  // means no badge renders for that entry -- this is supplementary context next to a real
  // price, never something that should block or error the pick flow.
  const [playerLogs, setPlayerLogs] = useState<Map<string, PlayerLogs>>(new Map());

  useEffect(() => {
    const requests = new Map<string, { playerName: string; propType: string }>();
    for (const group of groups) {
      const label = propTypeLabel(group.marketType) ?? group.marketType;
      for (const selection of group.selections) {
        if (!selection.playerName) continue;
        requests.set(`${selection.playerName}|${label}`, { playerName: selection.playerName, propType: label });
      }
    }
    // A category with nothing to look up (e.g. this game has no props at all yet) just
    // leaves whatever's already in state -- harmless even if it's a moment stale, since
    // computeHitRate always re-checks both playerName AND propType before using an entry,
    // so a leftover entry from a different category can never get matched to the wrong bet.
    if (requests.size === 0) return;

    let cancelled = false;
    getPlayerPropLogs(league, homeTeam, awayTeam, [...requests.values()]).then((result) => {
      if (cancelled || "error" in result) return;
      setPlayerLogs(new Map(result.players.map((p) => [p.playerName, p])));
    });
    return () => {
      cancelled = true;
    };
    // category (not groups, a fresh array every render derived from it) is the real
    // dependency -- re-keying on it avoids re-fetching on every render while still
    // refetching whenever the actual underlying data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, homeTeam, awayTeam, category]);

  if (groups.length === 0) {
    return <p className="text-xs text-muted">No props posted in this category yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const label = propTypeLabel(group.marketType) ?? group.marketType;
        const byPlayer = new Map<string, ResearchSelection[]>();
        for (const selection of group.selections) {
          if (!selection.playerName) continue;
          const list = byPlayer.get(selection.playerName) ?? [];
          list.push(selection);
          byPlayer.set(selection.playerName, list);
        }

        const hasOverUnderShape = group.selections.some((s) => s.side === Side.OVER || s.side === Side.UNDER);

        // Single-outcome markets (first/last touchdown scorer, line: null) have no
        // ladder/O-U concept at all -- always exactly one real selection per player, so no
        // pager chrome either, just one flat section of plain buttons.
        if (!hasOverUnderShape) {
          return (
            <CollapsibleSection key={group.marketType} title={label}>
              {[...byPlayer.entries()].map(([playerName, selections]) => (
                <Card key={playerName} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                  <PlayerNameCell playerName={playerName} team={teamByPlayer.get(playerName) ?? null} league={league} />
                  <div className="flex flex-wrap gap-1.5">
                    {selections.map((selection) => (
                      <button
                        key={selection.selectionId}
                        type="button"
                        className={tierButtonClass}
                        onClick={() => onSelectProp(buildPick(selection, playerName, label, homeTeam, awayTeam, externalId))}
                      >
                        <span className={bookTagClass}>{bookLabel(selection.sportsbook)}</span>
                        <span>{sideLabel(selection)}</span>
                        <span className={priceClass}>{formatPrice(selection.priceAmerican)}</span>
                        <PropHitRateDots logsByPlayer={playerLogs} playerName={playerName} propType={label} selection={selection} />
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </CollapsibleSection>
          );
        }

        // Ladder: every Over-side tier for players who have more than one -- a single tier
        // is just the O/U section's Over button again, not a real ladder to page through.
        const ladderRows = [...byPlayer.entries()]
          .map(([playerName, selections]) => ({
            playerName,
            tiers: [...selections.filter((s) => s.side === Side.OVER)].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
          }))
          .filter((r) => r.tiers.length >= 2);

        // O/U: every player's single main-line Over + Under pair, shown as a compact table
        // (a "Player / Over / Under" header once, then one row per player) rather than
        // repeating the word "Over"/"Under" inside every cell.
        const ouRows = [...byPlayer.entries()]
          .map(([playerName, selections]) => ({
            playerName,
            over: selections.find((s) => s.side === Side.OVER && s.isMainLine),
            under: selections.find((s) => s.side === Side.UNDER && s.isMainLine),
          }))
          .filter((r) => r.over || r.under);

        return (
          <div key={group.marketType} className="flex flex-col gap-2">
            {ladderRows.length > 0 && (
              <CollapsibleSection title={label}>
                {ladderRows.map(({ playerName, tiers }) => (
                  <Card key={playerName} elevated className={`grid ${nameGridCols} items-center gap-2 p-2`}>
                    <PlayerNameCell playerName={playerName} team={teamByPlayer.get(playerName) ?? null} league={league} />
                    <TierPager
                      items={tiers}
                      keyFor={(s) => s.selectionId}
                      renderItem={(s) => (
                        <button
                          type="button"
                          className={tierButtonClass}
                          onClick={() => onSelectProp(buildPick(s, playerName, label, homeTeam, awayTeam, externalId))}
                        >
                          <span className={bookTagClass}>{bookLabel(s.sportsbook)}</span>
                          <span>{s.line}+</span>
                          <span className={priceClass}>{formatPrice(s.priceAmerican)}</span>
                          <PropHitRateDots logsByPlayer={playerLogs} playerName={playerName} propType={label} selection={s} />
                        </button>
                      )}
                    />
                  </Card>
                ))}
              </CollapsibleSection>
            )}

            {ouRows.length > 0 && (
              <CollapsibleSection title={`${label} O/U`}>
                <div className={`${ouColumnsClass} px-1 text-[10px] font-medium uppercase tracking-wide text-subtle`}>
                  <span>Player</span>
                  <span className="text-center">Over</span>
                  <span className="text-center">Under</span>
                </div>
                {ouRows.map(({ playerName, over, under }) => (
                  <PropOuRow
                    key={playerName}
                    playerName={playerName}
                    team={teamByPlayer.get(playerName) ?? null}
                    league={league}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    over={over}
                    under={under}
                    label={label}
                    logsByPlayer={playerLogs}
                    externalId={externalId}
                    onSelectProp={onSelectProp}
                  />
                ))}
              </CollapsibleSection>
            )}
          </div>
        );
      })}
    </div>
  );
}
