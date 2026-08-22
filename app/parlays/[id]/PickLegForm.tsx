"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ArrowLeftIcon, RotateCcwIcon } from "@/components/ui/icons";
import { getRostersForGame, type GameRosterPlayer } from "@/lib/rosters/actions";
import { findTeamIdByName, isRosterLeague, LEAGUE_TEAMS, PICKABLE_LEAGUES, teamLogoUrl } from "@/lib/rosters/leagues";
import { propTypesForPosition } from "@/lib/rosters/propTypes";
import { useIsIOS } from "@/lib/useIsIOS";

import { pickLeg } from "../actions";
import { PlayerPropPicker } from "./PlayerPropPicker";
import { ScheduleBrowser } from "./ScheduleBrowser";
import { TeamLabel, TeamMarketGrid } from "./TeamMarketGrid";

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

// The whole set of data-entry fields renders as one continuous surface (one border, one
// background, divide-y between rows) instead of each row being its own separate box --
// reads as one form, not a stack of boxes. fieldRowClass divides a row's own 1-3 sub-fields
// (e.g. "Away @ Home") with a vertical rule instead of a border, since the outer
// fieldListClass container already supplies the border/background for everything.
const fieldListClass = "flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card";
const fieldRowClass = "flex items-stretch divide-x divide-border";
// text-base (not text-sm) and taller padding -- these are the fields you're most likely to
// be filling in on a phone, so bigger touch targets and less precision-typing beat density.
const groupFieldClass =
  "min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-foreground placeholder:text-subtle focus:bg-white/[0.03] focus:outline-none";

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
  // iOS's numeric/decimal keyboards have no minus key, breaking negative odds/spread entry
  // -- falls back to a plain keyboard there specifically, not for every platform.
  const isIOS = useIsIOS();

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

  const loadPlayers = useCallback(
    async (homeTeam: string, awayTeam: string) => {
      loadedForPair.current = `${homeTeam}|${awayTeam}`;
      setLoadingPlayers(true);
      setPlayersError(null);
      const result = await getRostersForGame(effectiveLeague, homeTeam, awayTeam);
      if ("error" in result) setPlayersError(result.error);
      else setPlayers(result.players);
      setLoadingPlayers(false);
    },
    [effectiveLeague],
  );

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
  }, [slip.kind, slip.homeTeam, slip.awayTeam, rosterSupported, effectiveLeague, loadPlayers]);

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

  // Resets the bet-specific fields (market/side/line/price, or player/stat) but keeps the
  // matchup -- for redoing the odds/type without re-picking the game.
  function clearBetDetails() {
    setSlip((prev) => (prev.kind === "team" ? emptyTeamSlip(prev) : emptyPropSlip(prev)));
    setHadProviderLink(false);
  }

  // Resets the matchup too (unlike clearBetDetails) -- this is what makes hasMatchup false
  // again, bringing back the browse/manual step to pick a different game entirely.
  function changeGame() {
    const emptyCarry = { homeTeam: "", awayTeam: "" };
    setSlip((prev) => (prev.kind === "team" ? emptyTeamSlip(emptyCarry) : emptyPropSlip(emptyCarry)));
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

  // Gate the propType suggestions to the selected player's position (a QB sees passing
  // props, a corner sees interceptions/tackles, etc.).
  const selectedPlayerPosition =
    slip.kind === "prop" ? players?.find((p) => p.name === slip.playerName)?.position : undefined;
  // Roster-backed leagues suggest nothing until a real player's actually been matched --
  // a generic pre-match fallback was more confusing than helpful (suggesting "Passing
  // Yards" before you've even typed a name). Leagues with no roster at all ("Other") have
  // no player to match against, so they keep a generic starting point.
  const propTypeOptions = rosterSupported
    ? selectedPlayerPosition
      ? propTypesForPosition(effectiveLeague, selectedPlayerPosition)
      : []
    : propTypesForPosition(effectiveLeague, undefined);

  // Shows the team's logo once its name resolves to a known team -- returns null (no icon)
  // for an unmatched name, so manual typing of an unlisted team just shows plain text.
  const awayLogo = teamLogoUrl(effectiveLeague, slip.awayTeam);
  const homeLogo = teamLogoUrl(effectiveLeague, slip.homeTeam);

  // Reused wherever price needs to stand alone (moneyline, yes/no props) vs. paired with a
  // line (spread/total, over/under props) -- one definition instead of four copies.
  const priceField = (
    <input
      value={slip.price}
      onChange={(e) => setSlip({ ...slip, price: e.target.value })}
      placeholder="Odds (e.g. -110)"
      required
      autoComplete="off"
      // American odds are routinely negative (favorites) -- iOS's numeric keypad has no
      // minus key at all, so iOS falls back to a plain keyboard; other platforms keep the
      // numeric one.
      inputMode={isIOS ? "text" : "numeric"}
      className={groupFieldClass}
    />
  );

  // The slip doesn't exist yet until there's actually a matchup to fill it in for --
  // browsing and typing a pick used to render simultaneously (a small sticky slip squeezed
  // below/behind a scrollable game list), which read as cramped and left too little room
  // for comfortable typing. Now it's two steps: pick a game (or choose manual entry) first,
  // then the slip takes over the space to fill in. "Clear" backs out of a selection and
  // returns to this step.
  const hasMatchup = !isSlipEmpty(slip);
  const showSlip = hasMatchup || entryMode === "manual";

  return (
    <div className="flex flex-col gap-3">
      {!hasMatchup && (
        <>
          <Card className="flex flex-wrap items-center gap-2 p-2">
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
          </Card>

          {canBrowseSchedule && entryMode === "browse" && (
            <ScheduleBrowser league={effectiveLeague} onSelectGame={onSelectScheduleGame} />
          )}
        </>
      )}

      {showSlip && (
        <div className="pb-[env(safe-area-inset-bottom)]">
          <Card className="flex flex-col gap-3 border-border-strong p-4 shadow-xl shadow-black/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {hasMatchup && (
                  <button
                    type="button"
                    title="Change game"
                    onClick={changeGame}
                    className="rounded-md border border-border-strong p-2 text-muted hover:text-foreground"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                  </button>
                )}
                {hasMatchup && (
                  <button
                    type="button"
                    title="Clear bet details"
                    onClick={clearBetDetails}
                    className="rounded-md border border-border-strong p-2 text-muted hover:text-foreground"
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
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

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              {rosterSupported && (
                <datalist id="league-teams">
                  {LEAGUE_TEAMS[effectiveLeague]?.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              )}
              {slip.kind === "prop" && !rosterSupported && (
                <datalist id="prop-types">
                  {propTypeOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              )}

              {/* Typing is only possible (and only needed) in manual mode -- once a
                  matchup's resolved via schedule browsing, this becomes a compact
                  read-only label instead (team-bet gets its team names from the grid
                  below either way, so it doesn't need this row at all in that case). */}
              {entryMode === "manual" ? (
                <div className={fieldListClass}>
                  <div className={fieldRowClass}>
                    <div className="relative min-w-0 flex-1">
                      {awayLogo && (
                        <Image
                          src={awayLogo}
                          alt=""
                          width={20}
                          height={20}
                          className="pointer-events-none absolute top-1/2 left-2 h-5 w-5 -translate-y-1/2 object-contain"
                        />
                      )}
                      <input
                        value={slip.awayTeam}
                        onChange={(e) => updateAwayTeam(e.target.value)}
                        placeholder="Away team"
                        required
                        autoComplete="off"
                        list={rosterSupported ? "league-teams" : undefined}
                        className={`${groupFieldClass} w-full text-right ${awayLogo ? "pl-8" : ""}`}
                      />
                    </div>
                    <span className="flex shrink-0 items-center px-2 text-xs text-subtle">@</span>
                    <div className="relative min-w-0 flex-1">
                      <input
                        value={slip.homeTeam}
                        onChange={(e) => updateHomeTeam(e.target.value)}
                        placeholder="Home team"
                        required
                        autoComplete="off"
                        list={rosterSupported ? "league-teams" : undefined}
                        className={`${groupFieldClass} w-full ${homeLogo ? "pr-8" : ""}`}
                      />
                      {homeLogo && (
                        <Image
                          src={homeLogo}
                          alt=""
                          width={20}
                          height={20}
                          className="pointer-events-none absolute top-1/2 right-2 h-5 w-5 -translate-y-1/2 object-contain"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                slip.kind === "prop" && (
                  <div className={fieldListClass}>
                    <div className="flex items-center justify-center gap-2 px-3 py-3">
                      <TeamLabel name={slip.awayTeam} logo={awayLogo} league={effectiveLeague} />
                      <span className="shrink-0 text-xs text-subtle">@</span>
                      <TeamLabel name={slip.homeTeam} logo={homeLogo} league={effectiveLeague} />
                    </div>
                  </div>
                )
              )}

              {slip.kind === "team" ? (
                <>
                  <TeamMarketGrid
                    league={effectiveLeague}
                    awayTeam={slip.awayTeam}
                    homeTeam={slip.homeTeam}
                    awayLogo={awayLogo}
                    homeLogo={homeLogo}
                    market={slip.market}
                    side={slip.side}
                    onSelect={(market, side) => setSlip({ ...slip, market, side })}
                  />
                  <div className={fieldListClass}>
                    <div className={fieldRowClass}>
                      {slip.market !== Market.MONEYLINE && (
                        <input
                          value={slip.line}
                          onChange={(e) => setSlip({ ...slip, line: e.target.value })}
                          placeholder="Line (e.g. -3.5)"
                          autoComplete="off"
                          // Shared between SPREAD (routinely negative, e.g. -3.5 for a
                          // favorite) and TOTAL (always positive) -- iOS's decimal keypad
                          // has no minus key, so iOS falls back to a plain keyboard here.
                          inputMode={isIOS ? "text" : "decimal"}
                          className={groupFieldClass}
                        />
                      )}
                      {priceField}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {rosterSupported ? (
                    <PlayerPropPicker
                      league={effectiveLeague}
                      players={players}
                      loading={loadingPlayers}
                      error={playersError}
                      onRetry={() => loadPlayers(slip.homeTeam.trim(), slip.awayTeam.trim())}
                      playerName={slip.playerName}
                      playerPosition={selectedPlayerPosition}
                      propType={slip.propType}
                      propTypeOptions={propTypeOptions}
                      onSelectPlayer={(name) => setSlip({ ...slip, playerName: name })}
                      onClearPlayer={() => setSlip({ ...slip, playerName: "", propType: "" })}
                      onSelectPropType={(t) => setSlip({ ...slip, propType: t })}
                    />
                  ) : (
                    <div className={fieldListClass}>
                      <div className={fieldRowClass}>
                        <input
                          value={slip.playerName}
                          onChange={(e) => setSlip({ ...slip, playerName: e.target.value })}
                          placeholder="Player name"
                          autoComplete="off"
                          className={groupFieldClass}
                        />
                        <input
                          value={slip.propType}
                          onChange={(e) => setSlip({ ...slip, propType: e.target.value })}
                          placeholder="Stat (e.g. Passing Yards)"
                          autoComplete="off"
                          list="prop-types"
                          className={groupFieldClass}
                        />
                      </div>
                    </div>
                  )}
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
                  <div className={fieldListClass}>
                    {slip.propShape === "overUnder" ? (
                      <>
                        <div className={fieldRowClass}>
                          <select
                            value={slip.side}
                            onChange={(e) => setSlip({ ...slip, side: e.target.value as Side })}
                            className={groupFieldClass}
                          >
                            <option value={Side.OVER}>Over</option>
                            <option value={Side.UNDER}>Under</option>
                          </select>
                          <input
                            value={slip.line}
                            onChange={(e) => setSlip({ ...slip, line: e.target.value })}
                            placeholder="Line (e.g. 250.5)"
                            autoComplete="off"
                            inputMode="decimal"
                            className={groupFieldClass}
                          />
                        </div>
                        <div className={fieldRowClass}>{priceField}</div>
                      </>
                    ) : (
                      <div className={fieldRowClass}>
                        <select
                          value={slip.side}
                          onChange={(e) => setSlip({ ...slip, side: e.target.value as Side })}
                          className={groupFieldClass}
                        >
                          <option value={Side.YES}>Yes</option>
                          <option value={Side.NO}>No</option>
                        </select>
                        {priceField}
                      </div>
                    )}
                  </div>
                </>
              )}

              {hadProviderLink && !slip.externalId && (
                <p className="text-xs text-pending">Unlinked — will save as manual entry.</p>
              )}

              {error && <p className="text-xs text-loss">{error}</p>}
              <Button type="submit" disabled={pending} className="w-fit">
                {pending ? "Saving…" : initial ? "Update pick" : "Confirm pick"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
