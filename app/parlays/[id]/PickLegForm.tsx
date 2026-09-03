"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RotateCcwIcon } from "@/components/ui/icons";
import { legSummary } from "@/lib/legSummary";
import { getRostersForGame, type GameRosterPlayer } from "@/lib/rosters/actions";
import { findTeamIdByName, isRosterLeague, LEAGUE_TEAMS, PICKABLE_LEAGUES, teamLogoUrl } from "@/lib/rosters/leagues";
import { isYesNoPropType, propTypesForPosition } from "@/lib/rosters/propTypes";
import type { PropPick, TeamBetPick } from "@/lib/research/types";
import { useIsIOS } from "@/lib/useIsIOS";

import { pickLeg } from "../actions";
import { PickBreadcrumb } from "./PickBreadcrumb";
import { PlayerPropPicker } from "./PlayerPropPicker";
import { ResearchBrowser } from "./ResearchBrowser";
import { ScheduleBrowser } from "./ScheduleBrowser";
import { TeamLabel, TeamMarketGrid } from "./TeamMarketGrid";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  league: string | null;
  market: Market;
  side: Side;
  teamSide: TeamSide | null;
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

const TEAM_MARKETS = new Set<Market>([Market.SPREAD, Market.TOTAL, Market.MONEYLINE, Market.TEAM_TOTAL]);

// The whole set of data-entry fields renders as one continuous surface (one border, one
// background, divide-y between rows) instead of each row being its own separate box --
// reads as one form, not a stack of boxes. fieldRowClass divides a row's own 1-3 sub-fields
// (e.g. "Away @ Home") with a vertical rule instead of a border, since the outer
// fieldListClass container already supplies the border/background for everything.
const fieldListClass = "flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card";
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
  teamSide: TeamSide | null;
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
    teamSide: null,
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
      teamSide: initial.teamSide,
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

// Whether real bet-specific data (not just the matchup) has been entered -- used to decide
// whether switching Team bet/Player prop needs a confirmation, since that switch discards
// this data.
const hasBetDetails = (slip: Slip) =>
  slip.kind === "team"
    ? Boolean(slip.price.trim() || slip.line.trim())
    : Boolean(slip.playerName.trim() || slip.propType.trim() || slip.price.trim() || slip.line.trim());

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
  // Set only when a Team bet/Player prop switch would discard real bet details -- gates the
  // confirmation Modal below rather than switching immediately.
  const [pendingKindSwitch, setPendingKindSwitch] = useState<"team" | "prop" | null>(null);
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
  }

  // Gates setKind behind a confirmation Modal only when real bet details would actually be
  // lost -- switching kind on a bare/just-started slip needs no nag.
  function requestKindSwitch(kind: "team" | "prop") {
    if (kind === slip.kind) return;
    if (hasBetDetails(slip)) setPendingKindSwitch(kind);
    else setKind(kind);
  }

  // Resets the bet-specific fields (market/side/line/price, or player/stat) but keeps the
  // matchup -- for redoing the odds/type without re-picking the game.
  function clearBetDetails() {
    setSlip((prev) => (prev.kind === "team" ? emptyTeamSlip(prev) : emptyPropSlip(prev)));
  }

  // Resets the matchup too (unlike clearBetDetails) -- this is what makes hasMatchup false
  // again, bringing back the browse/manual step to pick a different game entirely. The
  // browser itself (ResearchBrowser/ScheduleBrowser) stays mounted throughout -- only
  // hidden, not unmounted -- so this doesn't lose which game/tab was expanded.
  function changeGame() {
    const emptyCarry = { homeTeam: "", awayTeam: "" };
    setSlip((prev) => (prev.kind === "team" ? emptyTeamSlip(emptyCarry) : emptyPropSlip(emptyCarry)));
  }

  function onSelectScheduleGame(game: { homeTeam: string; awayTeam: string; externalId: string }) {
    setSlip((prev) => ({ ...prev, homeTeam: game.homeTeam, awayTeam: game.awayTeam, externalId: game.externalId }));
  }

  // Research (SharpAPI/NFL) picks carry a real market/side/line/price, unlike
  // ScheduleBrowser's bare matchup -- these replace the whole slip object (like setKind
  // does) rather than merging into whatever was there before, then still land in the same
  // editable slip UI below for a final review before confirming.
  function onSelectResearchTeamBet(pick: TeamBetPick) {
    setSlip({
      kind: "team",
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      market: pick.market,
      side: pick.side,
      teamSide: pick.teamSide ?? null,
      line: pick.line?.toString() ?? "",
      price: pick.price.toString(),
      externalId: pick.externalId,
    });
  }

  function onSelectResearchProp(pick: PropPick) {
    setSlip({
      kind: "prop",
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      propShape: pick.market === Market.PLAYER_PROP_YESNO ? "yesNo" : "overUnder",
      playerName: pick.playerName,
      propType: pick.propType,
      side: pick.side,
      line: pick.line?.toString() ?? "",
      price: pick.price.toString(),
      externalId: pick.externalId,
    });
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
        teamSide: slip.kind === "team" ? slip.teamSide : null,
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
        <Card className="flex flex-wrap items-center gap-2 p-2">
          <SegmentedControl size="sm" name="Sport" value={sport} onChange={setSport} options={SPORT_OPTIONS} />
          {canBrowseSchedule && (
            <SegmentedControl
              size="sm"
              name="Entry mode"
              value={entryMode}
              onChange={setEntryMode}
              options={[
                { value: "browse", label: effectiveLeague === "NFL" ? "Browse odds" : "Browse schedule" },
                { value: "manual", label: "Type it manually" },
              ]}
            />
          )}
        </Card>
      )}

      {/* Stays mounted (just hidden) once a matchup is picked, rather than unmounting --
          otherwise ResearchBrowser/ScheduleBrowser's own state (which game was expanded,
          which category tab was active) would be lost every time a pick is made, forcing a
          full re-browse-from-scratch for a second leg on the same game. Keyed on `sport` so
          switching leagues still starts fresh, which is the one case that really should
          reset browsing.

          NFL's ESPN schedule list lives here too (as a fallback under the priced board),
          not inside "manual" -- it used to be nested in manual mode, which quietly made
          "Type it manually" a third, unlabeled way to browse games rather than actually
          manual entry, and meant there was no way back to the priced board once you'd
          picked a game from it (the breadcrumb's "back" only clears the matchup, never the
          entry mode). Keeping both game sources on this one screen means "back" always
          lands you somewhere you can still see real odds, and "manual" goes back to meaning
          what it says everywhere else in the app: type it yourself.

          Two separate fallback affordances below, deliberately not conflated: the game
          itself is the rare miss (most NFL games this app cares about do have real odds
          posted), so that one's tucked in a collapsed section; a *specific bet* not being
          offered by the vendor is the far more common gap, so that hint stays a plain,
          always-visible line pointing straight at Type it manually rather than at another
          browsing list. */}
      {canBrowseSchedule && entryMode === "browse" && (
        <div className={hasMatchup ? "hidden" : ""}>
          {effectiveLeague === "NFL" ? (
            <div className="flex flex-col gap-3">
              <ResearchBrowser key={sport} onSelectTeamBet={onSelectResearchTeamBet} onSelectProp={onSelectResearchProp} />
              <p className="px-1 text-xs text-muted">
                Don&apos;t see your bet?{" "}
                <button
                  type="button"
                  onClick={() => setEntryMode("manual")}
                  className="text-foreground underline decoration-dotted underline-offset-2 hover:text-accent"
                >
                  Enter it manually
                </button>
                .
              </p>
              <CollapsibleSection title="Don't see your game? Browse the full schedule">
                <ScheduleBrowser key={`${sport}-fallback`} league="NFL" onSelectGame={onSelectScheduleGame} />
              </CollapsibleSection>
            </div>
          ) : (
            <ScheduleBrowser key={sport} league={effectiveLeague} onSelectGame={onSelectScheduleGame} />
          )}
        </div>
      )}

      {showSlip && (
        <div className="pb-[env(safe-area-inset-bottom)]">
          <Card className="flex flex-col gap-3 border-border-strong p-4 shadow-xl shadow-black/50">
            <div className="flex items-center justify-between gap-2">
              {hasMatchup ? (
                <PickBreadcrumb sport={sport} awayTeam={slip.awayTeam} homeTeam={slip.homeTeam} onBack={changeGame} />
              ) : (
                <span />
              )}
              {hasMatchup && (
                <IconButton
                  size="sm"
                  title="Clear bet details"
                  icon={<RotateCcwIcon className="h-4 w-4" />}
                  onClick={clearBetDetails}
                />
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <SegmentedControl
                size="sm"
                name="Pick kind"
                value={slip.kind}
                onChange={requestKindSwitch}
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
                  matchup's resolved via browsing, this becomes a compact read-only label
                  instead, for both pick kinds (a team-bet pick used to skip this row
                  entirely and rely solely on TeamMarketGrid's own row labels for game
                  identity, which was the one place a browse-mode pick showed no matchup
                  header at all -- now consistent with the prop-kind treatment). */}
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
                <div className={fieldListClass}>
                  <div className="flex items-center justify-center gap-2 px-3 py-3">
                    <TeamLabel name={slip.awayTeam} logo={awayLogo} league={effectiveLeague} />
                    <span className="shrink-0 text-xs text-subtle">@</span>
                    <TeamLabel name={slip.homeTeam} logo={homeLogo} league={effectiveLeague} />
                  </div>
                </div>
              )}

              {slip.kind === "team" ? (
                // A research pick already carries a real price -- re-showing the
                // numberless TeamMarketGrid pre-selected to match read as "the same board
                // rendered twice" directly under where the priced grid just was. A
                // ScheduleBrowser bare-matchup pick (or manual entry) has no price yet, so
                // it still needs the editable grid + inputs to set one.
                entryMode !== "manual" && slip.price ? (
                  <div className={fieldListClass}>
                    <div className="flex items-center justify-between gap-2 px-3 py-3">
                      <span className="text-sm font-medium">
                        {legSummary(
                          {
                            market: slip.market,
                            side: slip.side,
                            teamSide: slip.teamSide,
                            lineAtPick: slip.line ? Number(slip.line) : null,
                          },
                          { homeTeam: slip.homeTeam, awayTeam: slip.awayTeam },
                        )}
                      </span>
                      <span className="font-display text-sm tracking-wide text-accent tabular-nums">
                        {Number(slip.price) > 0 ? "+" : ""}
                        {slip.price}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <TeamMarketGrid
                      league={effectiveLeague}
                      awayTeam={slip.awayTeam}
                      homeTeam={slip.homeTeam}
                      awayLogo={awayLogo}
                      homeLogo={homeLogo}
                      market={slip.market}
                      side={slip.side}
                      teamSide={slip.teamSide}
                      onSelect={(market, side, teamSide) => setSlip({ ...slip, market, side, teamSide: teamSide ?? null })}
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
                )
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
                      // Auto-sets the shape (and matching default side) from the stat
                      // itself for known yes/no props (Anytime TD, Double-Double) instead
                      // of leaving the picker to notice and separately flip the Prop
                      // shape toggle -- one fewer tap, and no more Over/Under selector
                      // left showing for a bet that isn't shaped that way.
                      onSelectPropType={(t) =>
                        setSlip({
                          ...slip,
                          propType: t,
                          propShape: isYesNoPropType(t) ? "yesNo" : "overUnder",
                          side: isYesNoPropType(t) ? Side.YES : Side.OVER,
                        })
                      }
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

              {error && <p className="text-xs text-loss">{error}</p>}
              <Button type="submit" disabled={pending} className="w-fit">
                {pending ? "Saving…" : initial ? "Update pick" : "Confirm pick"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      <Modal
        open={pendingKindSwitch !== null}
        onClose={() => setPendingKindSwitch(null)}
        title={`Switch to ${pendingKindSwitch === "team" ? "Team bet" : "Player prop"}?`}
      >
        <p className="text-sm text-muted">This clears your current pick details.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setPendingKindSwitch(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (pendingKindSwitch) setKind(pendingKindSwitch);
              setPendingKindSwitch(null);
            }}
          >
            Switch
          </Button>
        </div>
      </Modal>
    </div>
  );
}
