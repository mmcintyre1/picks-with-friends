"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { XIcon } from "@/components/ui/icons";
import type { GameRosterPlayer } from "@/lib/rosters/actions";
import { hasMappedPropTypes, positionSortRank } from "@/lib/rosters/propTypes";

const pillClass = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border bg-card text-muted hover:border-accent hover:bg-accent/10 hover:text-foreground"
  }`;

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-3 text-base text-foreground placeholder:text-subtle focus:bg-white/[0.03] focus:outline-none";

// Two steps, both driven by data PickLegForm already fetches (no new network calls): pick
// a player, then pick a stat from that position's mapped list. The player step is a single
// search box, not a permanently-rendered list -- a full two-roster list is 15-25+ names,
// so it only appears as a dropdown while the box is focused/being typed into, same shape as
// a normal autocomplete. PickLegForm keeps owning the actual slip state; this is
// presentational plus callbacks, with its own local search-text/open state.
export function PlayerPropPicker({
  league,
  players,
  loading,
  error,
  onRetry,
  playerName,
  playerPosition,
  propType,
  propTypeOptions,
  onSelectPlayer,
  onClearPlayer,
  onSelectPropType,
}: {
  league: string;
  players: GameRosterPlayer[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  playerName: string;
  playerPosition: string | undefined;
  propType: string;
  propTypeOptions: string[];
  onSelectPlayer: (name: string) => void;
  onClearPlayer: () => void;
  onSelectPropType: (propType: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Skip positions with no real mapped props (offensive linemen etc.) so the list only
  // offers players actually worth picking -- falls back to everyone if that empties the
  // list entirely (an edge-case roster with no mapped positions at all). Sorted by
  // positionSortRank (offense before defense for NFL, etc.) -- there's no real
  // popularity/stats signal to rank by, so this is the closest achievable proxy.
  const sorted = useMemo(() => {
    if (!players) return [];
    const eligible = players.filter((p) => hasMappedPropTypes(league, p.position));
    const base = eligible.length > 0 ? eligible : players;
    return [...base].sort((a, b) => positionSortRank(league, a.position) - positionSortRank(league, b.position));
  }, [players, league]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(needle));
  }, [sorted, query]);

  if (playerName) {
    return (
      <div className="flex flex-col gap-2">
        <Card className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">
            {playerName}
            {playerPosition && <span className="ml-1.5 text-xs text-subtle">{playerPosition}</span>}
          </span>
          <IconButton size="sm" variant="ghost" title="Change player" icon={<XIcon className="h-3.5 w-3.5" />} onClick={onClearPlayer} />
        </Card>
        {propTypeOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {propTypeOptions.map((t) => (
              <button key={t} type="button" onClick={() => onSelectPropType(t)} className={pillClass(t === propType)}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <p className="text-xs text-muted">Loading players…</p>;
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-push">{error}</span>
        <button type="button" onClick={onRetry} className="text-muted underline hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }
  if (!players || players.length === 0) {
    return <p className="text-xs text-muted">Enter both teams above to load their rosters.</p>;
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Search players…"
        autoComplete="off"
        className={inputClass}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border-strong bg-card-elevated shadow-xl">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No match.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={`${p.name}-${p.team}`}
                type="button"
                // Prevents the input's blur (which would close this dropdown) from firing
                // before the click handler below runs -- the standard combobox pattern.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectPlayer(p.name);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-subtle">
                  {p.team} · {p.position}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
