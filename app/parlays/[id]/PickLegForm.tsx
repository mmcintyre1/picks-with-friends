"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { getRostersForGame, type GameRosterPlayer } from "@/lib/rosters/actions";
import { findTeamIdByName, isRosterLeague, LEAGUE_TEAMS, PICKABLE_LEAGUES } from "@/lib/rosters/leagues";
import { propTypesForPosition } from "@/lib/rosters/propTypes";

import { pickLeg } from "../actions";
import { ScheduleBrowser } from "./ScheduleBrowser";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  league: string | null;
  market: Market;
  side: Side;
  line: number | null;
  price: number | null;
  playerName: string | null;
  propType: string | null;
};

type Sport = "NFL" | "NBA" | "MLB" | "NHL" | "other";

const SPORT_OPTIONS: { value: Sport; label: string }[] = [
  ...PICKABLE_LEAGUES.map((l) => ({ value: l as Sport, label: l })),
  { value: "other", label: "Other" },
];

const TEAM_MARKETS = new Set<Market>([Market.SPREAD, Market.TOTAL, Market.MONEYLINE]);

const fieldClass =
  "rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-subtle";

function initialSport(league: string | null | undefined): Sport {
  return league && (PICKABLE_LEAGUES as string[]).includes(league) ? (league as Sport) : "other";
}

// A single discriminated-union "slip" replaces the old team-bet-fields-plus-prop-fields
// parallel useState hooks -- switching kind swaps the whole object instead of leaving the
// other branch's stale values sitting in state (the old bug this fixes).
type TeamSlip = {
  kind: "team";
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  line: string;
  price: string;
  externalId: string | null;
};

type PropSlip = {
  kind: "prop";
  homeTeam: string;
  awayTeam: string;
  propShape: "overUnder" | "yesNo";
  playerName: string;
  propType: string;
  side: Side;
  line: string;
  price: string;
  externalId: string | null;
};

type Slip = TeamSlip | PropSlip;

function emptyTeamSlip(carry: { homeTeam: string; awayTeam: string }): TeamSlip {
  return {
    kind: "team",
    homeTeam: carry.homeTeam,
    awayTeam: carry.awayTeam,
    market: Market.SPREAD,
    side: Side.HOME,
    line: "",
    price: "",
    externalId: null,
  };
}

function emptyPropSlip(carry: { homeTeam: string; awayTeam: string }): PropSlip {
  return {
    kind: "prop",
    homeTeam: carry.homeTeam,
    awayTeam: carry.awayTeam,
    propShape: "overUnder",
    playerName: "",
    propType: "",
    side: Side.OVER,
    line: "",
    price: "",
    externalId: null,
  };
}

function slipFromInitial(initial?: Initial): Slip {
  const carry = { homeTeam: initial?.homeTeam ?? "", awayTeam: initial?.awayTeam ?? "" };
  if (!initial) return emptyTeamSlip(carry);
  if (TEAM_MARKETS.has(initial.market)) {
    return {
      kind: "team",
      ...carry,
      market: initial.market,
      side: initial.side,
      line: initial.line?.toString() ?? "",
      price: initial.price?.toString() ?? "",
      externalId: null,
    };
  }
  return {
    kind: "prop",
    ...carry,
    propShape: initial.market === Market.PLAYER_PROP_YESNO ? "yesNo" : "overUnder",
    playerName: initial.playerName ?? "",
    propType: initial.propType ?? "",
    side: initial.side,
    line: initial.line?.toString() ?? "",
    price: initial.price?.toString() ?? "",
    externalId: null,
  };
}

// "HOME"/"AWAY" on their own don't say which team that is -- show the actual team name
// once one's been entered, falling back to the literal side name until then.
function sideLabel(side: Side, homeTeam: string, awayTeam: string): string {
  if (side === Side.HOME) return homeTeam.trim() || "Home";
  if (side === Side.AWAY) return awayTeam.trim() || "Away";
  return side === Side.OVER ? "Over" : "Under";
}

const isSlipEmpty = (slip: Slip) =>
  !slip.homeTeam.trim() && !slip.awayTeam.trim() && !slip.price.trim() && !slip.externalId;

export function PickLegForm({
  parlayId,
  initial,
  defaultLeague,
  onDone,
}: {
  parlayId: string;
  initial?: Initial;
  // A hint, not a restriction -- seeds the Sport selector's initial value (e.g. a parlay
  // tagged "1pm" defaults to NFL) but every pick can still choose any sport.
  defaultLeague: string;
  onDone?: () => void;
}) {
  const [slip, setSlip] = useState<Slip>(() => slipFromInitial(initial));
  const [sport, setSport] = useState<Sport>(() => initialSport(initial?.league ?? defaultLeague));
  const [hadProviderLink, setHadProviderLink] = useState(false);

  // The league this specific pick is actually for -- always the Sport selector's choice.
  const effectiveLeague = sport === "other" ? "" : sport;
  const canBrowseSchedule = sport !== "other";

  const [entryMode, setEntryMode] = useState<"browse" | "manual">(canBrowseSchedule ? "browse" : "manual");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [players, setPlayers] = useState<GameRosterPlayer[] | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  // Tracks which (home, away) pair the roster was last fetched for, so the auto-load
  // effect below doesn't re-fetch on every keystroke/re-render -- only when the actual
  // matchup changes. A ref, not state, since it's read/written but never itself rendered.
  const loadedForPair = useRef<string | null>(null);

  // Roster/player-prop autofill covers NFL/NBA/MLB/NHL (lib/rosters/leagues.ts).
  const rosterSupported = isRosterLeague(effectiveLeague);

  async function loadPlayers(homeTeam: string, awayTeam: string) {
    loadedForPair.current = `${homeTeam}|${awayTeam}`;
    setLoadingPlayers(true);
    setPlayersError(null);
    const result = await getRostersForGame(effectiveLeague, homeTeam, awayTeam);
    if ("error" in result) setPlayersError(result.error);
    else setPlayers(result.players);
    setLoadingPlayers(false);
  }

  // Auto-loads both rosters as soon as the typed/selected team names resolve to real teams
  // in this pick's league -- no manual "Load players" button. Safe to fire eagerly:
  // espnProvider.ts caches each team's roster for 6 hours, so re-visiting the same matchup
  // (or having this effect re-run) never re-hits the network, just the in-memory cache.
  useEffect(() => {
    if (slip.kind !== "prop" || !rosterSupported) return;
    const home = slip.homeTeam.trim();
    const away = slip.awayTeam.trim();
    if (!home || !away || !findTeamIdByName(effectiveLeague, home) || !findTeamIdByName(effectiveLeague, away)) {
      return;
    }

    const pairKey = `${home}|${away}`;
    if (pairKey === loadedForPair.current) return;
    loadPlayers(home, away);
  }, [slip.kind, slip.homeTeam, slip.awayTeam, rosterSupported, effectiveLeague]);

  function updateHomeTeam(value: string) {
    setSlip((prev) => ({ ...prev, homeTeam: value, externalId: null }));
  }
  function updateAwayTeam(value: string) {
    setSlip((prev) => ({ ...prev, awayTeam: value, externalId: null }));
  }

  function setKind(kind: "team" | "prop") {
    setSlip((prev) => (kind === "team" ? emptyTeamSlip(prev) : emptyPropSlip(prev)));
    setHadProviderLink(false);
  }

  function clearSlip() {
    setSlip((prev) => (prev.kind === "team" ? emptyTeamSlip(prev) : emptyPropSlip(prev)));
    setHadProviderLink(false);
  }

  function onSelectScheduleGame(game: { homeTeam: string; awayTeam: string; externalId: string }) {
    setSlip((prev) => ({ ...prev, homeTeam: game.homeTeam, awayTeam: game.awayTeam, externalId: game.externalId }));
    setHadProviderLink(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const resolvedMarket =
      slip.kind === "team" ? slip.market : slip.propShape === "overUnder" ? Market.PLAYER_PROP : Market.PLAYER_PROP_YESNO;

    startTransition(async () => {
      const result = await pickLeg(parlayId, {
        homeTeam: slip.homeTeam,
        awayTeam: slip.awayTeam,
        league: effectiveLeague,
        market: resolvedMarket,
        side: slip.side,
        line: slip.kind === "prop" && slip.propShape === "yesNo" ? "" : slip.line,
        price: slip.price,
        playerName: slip.kind === "prop" ? slip.playerName : "",
        propType: slip.kind === "prop" ? slip.propType : "",
        externalId: slip.externalId ?? "",
      });
      if (result?.error) setError(result.error);
      else onDone?.();
    });
  }

  const teamSideOptions = slip.kind === "team" && slip.market === Market.TOTAL ? [Side.OVER, Side.UNDER] : [Side.HOME, Side.AWAY];
  // Gate the propType suggestions to the selected player's position (a QB sees passing
  // props, a corner sees interceptions/tackles, etc.) rather than one generic list --
  // falls back to a broad generic set until a player's actually been matched.
  const selectedPlayerPosition =
    slip.kind === "prop" ? players?.find((p) => p.name === slip.playerName)?.position : undefined;
  const propTypeOptions = propTypesForPosition(effectiveLeague, selectedPlayerPosition);

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        size="sm"
        name="Sport"
        value={sport}
        onChange={(next) => {
          setSport(next);
          setHadProviderLink(false);
        }}
        options={SPORT_OPTIONS}
      />

      {canBrowseSchedule && (
        <SegmentedControl
          size="sm"
          name="Entry mode"
          value={entryMode}
          onChange={setEntryMode}
          options={[
            { value: "browse", label: "Browse schedule" },
            { value: "manual", label: "Type it manually" },
          ]}
        />
      )}

      {canBrowseSchedule && entryMode === "browse" && (
        <ScheduleBrowser league={effectiveLeague} onSelectGame={onSelectScheduleGame} />
      )}

      {/* Sticky rather than a modal -- this is the bet slip: it should stay reachable while
          you keep browsing games above it, snapping to the bottom of the screen once you've
          scrolled past its normal position, instead of interrupting browsing every click. */}
      <div className="sticky bottom-4 z-10 pb-[env(safe-area-inset-bottom)]">
        <Card className="flex flex-col gap-3 border-border-strong p-3 shadow-xl shadow-black/50">
          <div className="flex items-center justify-end gap-2">
            {!isSlipEmpty(slip) && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSlip}>
                Clear
              </Button>
            )}
            <SegmentedControl
              size="sm"
              name="Pick kind"
              value={slip.kind}
              onChange={setKind}
              options={[
                { value: "team", label: "Team bet" },
                { value: "prop", label: "Player prop" },
              ]}
            />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            {rosterSupported && (
              <datalist id="league-teams">
                {LEAGUE_TEAMS[effectiveLeague]?.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={slip.awayTeam}
                onChange={(e) => updateAwayTeam(e.target.value)}
                placeholder="Away team"
                required
                autoComplete="off"
                list={rosterSupported ? "league-teams" : undefined}
                className={fieldClass}
              />
              <input
                value={slip.homeTeam}
                onChange={(e) => updateHomeTeam(e.target.value)}
                placeholder="Home team"
                required
                autoComplete="off"
                list={rosterSupported ? "league-teams" : undefined}
                className={fieldClass}
              />
            </div>

            {hadProviderLink && !slip.externalId && (
              <p className="text-xs text-pending">Unlinked — will save as manual entry.</p>
            )}

            {slip.kind === "team" ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={slip.market}
                    onChange={(e) => {
                      const m = e.target.value as Market;
                      setSlip({ ...slip, market: m, side: m === Market.TOTAL ? Side.OVER : Side.HOME });
                    }}
                    className={fieldClass}
                  >
                    <option value={Market.SPREAD}>Spread</option>
                    <option value={Market.TOTAL}>Total</option>
                    <option value={Market.MONEYLINE}>Moneyline</option>
                  </select>
                  <select
                    value={slip.side}
                    onChange={(e) => setSlip({ ...slip, side: e.target.value as Side })}
                    className={fieldClass}
                  >
                    {teamSideOptions.map((s) => (
                      <option key={s} value={s}>
                        {sideLabel(s, slip.homeTeam, slip.awayTeam)}
                      </option>
                    ))}
                  </select>
                </div>
                {slip.market !== Market.MONEYLINE && (
                  <input
                    value={slip.line}
                    onChange={(e) => setSlip({ ...slip, line: e.target.value })}
                    placeholder="Line (e.g. -3.5)"
                    autoComplete="off"
                    className={fieldClass}
                  />
                )}
              </>
            ) : (
              <>
                {rosterSupported && (loadingPlayers || playersError) && (
                  <div className="flex items-center gap-2 text-xs">
                    {loadingPlayers && <span className="text-muted">Loading players…</span>}
                    {playersError && (
                      <>
                        <span className="text-push">{playersError}</span>
                        <button
                          type="button"
                          onClick={() => loadPlayers(slip.homeTeam.trim(), slip.awayTeam.trim())}
                          className="text-muted underline hover:text-foreground"
                        >
                          Retry
                        </button>
                      </>
                    )}
                  </div>
                )}
                {players && (
                  <datalist id="prop-players">
                    {players.map((p) => (
                      <option key={`${p.name}-${p.team}`} value={p.name}>
                        {p.team} · {p.position}
                      </option>
                    ))}
                  </datalist>
                )}
                <datalist id="prop-types">
                  {propTypeOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={slip.playerName}
                    onChange={(e) => setSlip({ ...slip, playerName: e.target.value })}
                    placeholder="Player name"
                    autoComplete="off"
                    list={players ? "prop-players" : undefined}
                    className={fieldClass}
                  />
                  <input
                    value={slip.propType}
                    onChange={(e) => setSlip({ ...slip, propType: e.target.value })}
                    placeholder="Stat (e.g. Passing Yards)"
                    autoComplete="off"
                    list="prop-types"
                    className={fieldClass}
                  />
                </div>
                <SegmentedControl
                  size="sm"
                  name="Prop shape"
                  value={slip.propShape}
                  onChange={(shape) =>
                    setSlip({ ...slip, propShape: shape, side: shape === "yesNo" ? Side.YES : Side.OVER })
                  }
                  options={[
                    { value: "overUnder", label: "Over/Under" },
                    { value: "yesNo", label: "Yes/No" },
                  ]}
                />
                {slip.propShape === "overUnder" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={slip.side}
                      onChange={(e) => setSlip({ ...slip, side: e.target.value as Side })}
                      className={fieldClass}
                    >
                      <option value={Side.OVER}>Over</option>
                      <option value={Side.UNDER}>Under</option>
                    </select>
                    <input
                      value={slip.line}
                      onChange={(e) => setSlip({ ...slip, line: e.target.value })}
                      placeholder="Line (e.g. 250.5)"
                      autoComplete="off"
                      className={fieldClass}
                    />
                  </div>
                ) : (
                  <select
                    value={slip.side}
                    onChange={(e) => setSlip({ ...slip, side: e.target.value as Side })}
                    className={fieldClass}
                  >
                    <option value={Side.YES}>Yes</option>
                    <option value={Side.NO}>No</option>
                  </select>
                )}
              </>
            )}

            <input
              value={slip.price}
              onChange={(e) => setSlip({ ...slip, price: e.target.value })}
              placeholder="Odds (e.g. -110)"
              required
              autoComplete="off"
              className={fieldClass}
            />
            {error && <p className="text-xs text-loss">{error}</p>}
            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Saving…" : initial ? "Update pick" : "Confirm pick"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
