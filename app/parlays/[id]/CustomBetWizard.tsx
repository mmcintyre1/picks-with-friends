"use client";

import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";

import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SignedNumberInput } from "@/components/ui/SignedNumberInput";
import { formatGameTime } from "@/lib/formatGameTime";
import { correlationsWith, resolvePlayerTeam, type CorrelationLeg, type GameRoster } from "@/lib/correlation";
import { legSummary } from "@/lib/legSummary";
import { read } from "@/lib/readClient";
import type { GameRosterPlayer } from "@/lib/rosters/actions";
import { isRosterLeague, LEAGUE_TEAMS, teamAbbreviation, teamLogoUrl } from "@/lib/rosters/leagues";
import { GENERIC_PROP_TYPES, isYesNoPropType, propTypesForPosition } from "@/lib/rosters/propTypes";
import type { ScheduleGame } from "@/lib/schedule/types";

import { pickLeg } from "../actions";
import { CorrelationNotes } from "./CorrelationNotes";
import { PlayerPropPicker } from "./PlayerPropPicker";
import { TeamAvatar } from "./TeamMarketGrid";

type BetType = "spread" | "total" | "moneyline" | "teamTotal" | "prop";
type Step = "game" | "bet" | "pick" | "numbers";
type Game = { homeTeam: string; awayTeam: string; externalId: string };

const BET_TYPES: { value: BetType; label: string; hint: string }[] = [
  { value: "spread", label: "Spread", hint: "Team covers the points" },
  { value: "moneyline", label: "Moneyline", hint: "Team wins outright" },
  { value: "total", label: "Total", hint: "Game's combined points" },
  { value: "teamTotal", label: "Team total", hint: "One team's points" },
  { value: "prop", label: "Player prop", hint: "A player's stat" },
];

const SIDE_LABEL: Partial<Record<Side, string>> = { [Side.YES]: "Yes", [Side.NO]: "No", [Side.OVER]: "Over", [Side.UNDER]: "Under" };

const ODDS_CHIPS = ["-110", "-115", "-120", "-105", "+100", "+110"];

const tileClass = (active = false) =>
  `flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
    active ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent hover:bg-accent/5"
  }`;
const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none";
const chipClass = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-sm font-medium tabular-nums ${
    active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted hover:border-accent"
  }`;

function marketFor(bet: BetType, propType: string): Market {
  if (bet === "spread") return Market.SPREAD;
  if (bet === "total") return Market.TOTAL;
  if (bet === "moneyline") return Market.MONEYLINE;
  if (bet === "teamTotal") return Market.TEAM_TOTAL;
  return isYesNoPropType(propType) ? Market.PLAYER_PROP_YESNO : Market.PLAYER_PROP;
}

const needsLine = (m: Market) => m !== Market.MONEYLINE && m !== Market.PLAYER_PROP_YESNO;

function stepLine(line: string, delta: number): string {
  const n = Number(line) || 0;
  return String(Math.round((n + delta) * 2) / 2);
}

// "Enter my own bet": one question per screen, mostly taps, for when the odds board doesn't
// have what you want. Replaces the old Browse schedule / Type it manually tabs and the
// all-fields-at-once slip card. A running summary at the top lets you jump back to any step.
export function CustomBetWizard({
  parlayId,
  league,
  onDone,
  otherLegs,
  gameRosters,
}: {
  parlayId: string;
  league: string;
  onDone?: () => void;
  otherLegs: CorrelationLeg[];
  gameRosters: GameRoster[];
}) {
  const [step, setStep] = useState<Step>("game");
  const [game, setGame] = useState<Game | null>(null);
  const [bet, setBet] = useState<BetType | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const [teamSide, setTeamSide] = useState<TeamSide | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [propType, setPropType] = useState("");
  const [line, setLine] = useState("");
  const [price, setPrice] = useState("-110");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const market = bet ? marketFor(bet, propType) : null;
  const abbr = (name: string) => teamAbbreviation(league, name) || name;

  function chooseGame(g: Game) {
    setGame(g);
    // A new game invalidates any team/player already chosen.
    setSide(null);
    setTeamSide(null);
    setPlayerName("");
    setPropType("");
    setStep(bet ? "pick" : "bet");
  }
  function chooseBet(b: BetType) {
    if (b !== bet) {
      setSide(null);
      setTeamSide(null);
      setLine("");
    }
    setBet(b);
    setStep("pick");
  }
  function choosePick(s: Side, ts: TeamSide | null = null) {
    setSide(s);
    setTeamSide(ts);
    setStep("numbers");
  }

  function submit() {
    if (!game || !bet || !side || !market) return;
    setError(null);
    startTransition(async () => {
      const result = await pickLeg(parlayId, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        league,
        market,
        side,
        teamSide: market === Market.TEAM_TOTAL ? teamSide : null,
        line: needsLine(market) ? line : "",
        price,
        playerName: bet === "prop" ? playerName : "",
        propType: bet === "prop" ? propType : "",
        externalId: game.externalId,
      });
      if (result?.error) setError(result.error);
      else onDone?.();
    });
  }

  const summaryPick =
    game && bet && side && market
      ? legSummary({ market, side, teamSide, lineAtPick: null, playerName, propType }, game).replace(/ \?$/, "")
      : null;

  // Same-game correlation with everyone else's legs, checked once the bet is fully chosen.
  const correlations =
    game && side && market
      ? correlationsWith(
          {
            owner: "You",
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            market,
            side,
            teamSide,
            playerName: bet === "prop" ? playerName : null,
            propType: bet === "prop" ? propType : null,
            playerTeam: bet === "prop" ? resolvePlayerTeam(gameRosters, game, playerName) : null,
            summary: summaryPick ?? "",
          },
          otherLegs,
        )
      : [];

  const crumbs: { step: Step; label: string }[] = [
    game ? { step: "game", label: `${abbr(game.awayTeam)} @ ${abbr(game.homeTeam)}` } : null,
    bet ? { step: "bet", label: BET_TYPES.find((b) => b.value === bet)!.label } : null,
    summaryPick && step === "numbers" ? { step: "pick", label: summaryPick } : null,
  ].filter((c): c is { step: Step; label: string } => c !== null);

  const stepIndex = { game: 1, bet: 2, pick: 3, numbers: 4 }[step];

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-subtle">
          <span className="font-medium uppercase tracking-wide">Enter my own bet</span>
          <span>Step {stepIndex} of 4</span>
        </div>
        {crumbs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {crumbs.map((c) => (
              <button
                key={c.step}
                type="button"
                onClick={() => setStep(c.step)}
                className="rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
                title="Change"
              >
                {c.label} ✎
              </button>
            ))}
          </div>
        )}
      </div>

      {step === "game" && <GameStep league={league} onChoose={chooseGame} />}

      {step === "bet" && (
        <Question title="What kind of bet?">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BET_TYPES.map((b) => (
              <button key={b.value} type="button" onClick={() => chooseBet(b.value)} className={tileClass(b.value === bet)}>
                <span className="flex flex-col">
                  <span className="font-display text-lg tracking-wide">{b.label}</span>
                  <span className="text-xs text-subtle">{b.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Question>
      )}

      {step === "pick" && game && bet && bet !== "prop" && (
        <TeamPickStep league={league} game={game} bet={bet} side={side} teamSide={teamSide} onChoose={choosePick} />
      )}

      {step === "pick" && game && bet === "prop" && (
        <PropPickStep
          league={league}
          game={game}
          playerName={playerName}
          propType={propType}
          side={side}
          onPlayer={(name) => {
            setPlayerName(name);
            setPropType("");
            setSide(null);
          }}
          onPropType={(t) => {
            setPropType(t);
            setSide(null);
          }}
          onSide={(s) => choosePick(s)}
        />
      )}

      {step === "numbers" && game && market && side && (
        <Question title={needsLine(market) ? "Line and odds" : "Odds"}>
          {needsLine(market) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Line</span>
              <div className="flex items-stretch gap-2">
                <button type="button" className={chipClass(false)} onClick={() => setLine((l) => stepLine(l, -0.5))} aria-label="Line minus 0.5">
                  −½
                </button>
                <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-border bg-card focus-within:border-accent">
                  {market === Market.SPREAD ? (
                    <SignedNumberInput
                      label="Line"
                      value={line}
                      onChange={setLine}
                      placeholder="3.5"
                      decimal
                      defaultNegative
                      inputClassName="min-w-0 flex-1 bg-transparent px-3 py-3 text-base focus:outline-none"
                    />
                  ) : (
                    <input
                      aria-label="Line"
                      value={line}
                      onChange={(e) => setLine(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder={market === Market.PLAYER_PROP ? "e.g. 62.5" : "e.g. 44.5"}
                      inputMode="decimal"
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base focus:outline-none"
                    />
                  )}
                </div>
                <button type="button" className={chipClass(false)} onClick={() => setLine((l) => stepLine(l, 0.5))} aria-label="Line plus 0.5">
                  +½
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Odds</span>
            <div className="flex flex-wrap gap-1.5">
              {ODDS_CHIPS.map((o) => (
                <button key={o} type="button" className={chipClass(price === o || price === o.replace("+", ""))} onClick={() => setPrice(o.replace("+", ""))}>
                  {o}
                </button>
              ))}
            </div>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-card focus-within:border-accent">
              <SignedNumberInput
                label="Odds"
                value={price}
                onChange={setPrice}
                placeholder="Other odds"
                defaultNegative
                inputClassName="min-w-0 flex-1 bg-transparent px-3 py-3 text-base focus:outline-none"
              />
            </div>
          </div>
          <CorrelationNotes intro="Heads up — this pick is correlated with:" correlations={correlations} />
          {error && <p className="text-sm text-loss">{error}</p>}
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !price.replace(/[+-]/g, "") || (needsLine(market) && !line.replace(/[+-]/g, ""))}
            className="w-full py-3 text-base"
          >
            {pending ? "Saving…" : "Confirm pick"}
          </Button>
        </Question>
      )}
    </Card>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-xl tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function GameStep({ league, onChoose }: { league: string; onChoose: (g: Game) => void }) {
  const hasSchedule = isRosterLeague(league);
  const [games, setGames] = useState<ScheduleGame[] | null>(hasSchedule ? null : []);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(!hasSchedule);
  const [away, setAway] = useState("");
  const [home, setHome] = useState("");

  useEffect(() => {
    if (!hasSchedule) return;
    let cancelled = false;
    read("getScheduleGames", league)
      .then((r) => {
        if (cancelled) return;
        if ("error" in r) setFailed(true);
        else setGames(r.games);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [league, hasSchedule]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!games || !q) return games ?? [];
    return games.filter((g) => `${g.awayTeam} ${g.homeTeam}`.toLowerCase().includes(q));
  }, [games, query]);

  if (typing) {
    return (
      <Question title="Which game?">
        {LEAGUE_TEAMS[league] && (
          <datalist id="wizard-teams">
            {LEAGUE_TEAMS[league].map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        )}
        <input value={away} onChange={(e) => setAway(e.target.value)} placeholder="Away team" list="wizard-teams" autoComplete="off" className={inputClass} />
        <input value={home} onChange={(e) => setHome(e.target.value)} placeholder="Home team" list="wizard-teams" autoComplete="off" className={inputClass} />
        <Button type="button" disabled={!away.trim() || !home.trim()} onClick={() => onChoose({ awayTeam: away.trim(), homeTeam: home.trim(), externalId: "" })} className="w-full py-3 text-base">
          Next
        </Button>
        {hasSchedule && (
          <button type="button" onClick={() => setTyping(false)} className="text-sm text-muted underline">
            Back to the game list
          </button>
        )}
      </Question>
    );
  }

  return (
    <Question title="Which game?">
      {games && games.length > 6 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams…" autoComplete="off" className={inputClass} />
      )}
      {games === null && !failed && <p className="text-sm text-muted">Loading games…</p>}
      {failed && <p className="text-sm text-push">Couldn&apos;t load the schedule.</p>}
      {games && games.length === 0 && <p className="text-sm text-muted">No upcoming {league} games found.</p>}
      <div className="flex flex-col gap-2">
        {filtered.map((g) => (
          <button key={g.id} type="button" onClick={() => onChoose({ awayTeam: g.awayTeam, homeTeam: g.homeTeam, externalId: g.id })} className={tileClass()}>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <TeamAvatar logo={teamLogoUrl(league, g.awayTeam)} name={g.awayTeam} size="h-5 w-5" />
                {g.awayTeam}
              </span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <TeamAvatar logo={teamLogoUrl(league, g.homeTeam)} name={g.homeTeam} size="h-5 w-5" />
                <span className="text-subtle">@</span> {g.homeTeam}
              </span>
            </span>
            <span className="shrink-0 text-xs text-subtle">{formatGameTime(g.commenceTime)}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setTyping(true)} className="text-sm text-muted underline">
        Game not listed? Type the teams
      </button>
    </Question>
  );
}

function TeamPickStep({
  league,
  game,
  bet,
  side,
  teamSide,
  onChoose,
}: {
  league: string;
  game: Game;
  bet: Exclude<BetType, "prop">;
  side: Side | null;
  teamSide: TeamSide | null;
  onChoose: (s: Side, ts?: TeamSide | null) => void;
}) {
  const teams = [
    { name: game.awayTeam, side: Side.AWAY, teamSide: TeamSide.AWAY },
    { name: game.homeTeam, side: Side.HOME, teamSide: TeamSide.HOME },
  ];
  const teamButton = (t: (typeof teams)[number], label: string, onClick: () => void, active: boolean) => (
    <button key={label} type="button" onClick={onClick} className={tileClass(active)}>
      <TeamAvatar logo={teamLogoUrl(league, t.name)} name={t.name} size="h-7 w-7" />
      <span className="font-display text-lg tracking-wide">{label}</span>
    </button>
  );

  if (bet === "total") {
    return (
      <Question title="Over or under?">
        <div className="grid grid-cols-2 gap-2">
          {[Side.OVER, Side.UNDER].map((s) => (
            <button key={s} type="button" onClick={() => onChoose(s)} className={`${tileClass(side === s)} justify-center`}>
              <span className="font-display text-lg tracking-wide">{s === Side.OVER ? "Over" : "Under"}</span>
            </button>
          ))}
        </div>
      </Question>
    );
  }
  if (bet === "teamTotal") {
    return (
      <Question title="Which team, over or under?">
        <div className="grid grid-cols-2 gap-2">
          {teams.flatMap((t) =>
            [Side.OVER, Side.UNDER].map((s) => (
              <button key={`${t.name}-${s}`} type="button" onClick={() => onChoose(s, t.teamSide)} className={tileClass(side === s && teamSide === t.teamSide)}>
                <TeamAvatar logo={teamLogoUrl(league, t.name)} name={t.name} size="h-6 w-6" />
                <span className="font-display tracking-wide">{s === Side.OVER ? "Over" : "Under"}</span>
              </button>
            )),
          )}
        </div>
      </Question>
    );
  }
  return (
    <Question title={bet === "spread" ? "Which team covers?" : "Which team wins?"}>
      <div className="flex flex-col gap-2">{teams.map((t) => teamButton(t, t.name, () => onChoose(t.side), side === t.side))}</div>
    </Question>
  );
}

function PropPickStep({
  league,
  game,
  playerName,
  propType,
  side,
  onPlayer,
  onPropType,
  onSide,
}: {
  league: string;
  game: Game;
  playerName: string;
  propType: string;
  side: Side | null;
  onPlayer: (name: string) => void;
  onPropType: (t: string) => void;
  onSide: (s: Side) => void;
}) {
  const hasRoster = isRosterLeague(league);
  const [players, setPlayers] = useState<GameRosterPlayer[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [typedName, setTypedName] = useState(playerName);

  useEffect(() => {
    if (!hasRoster) return;
    let cancelled = false;
    read("getRostersForGame", league, game.homeTeam, game.awayTeam)
      .then((r) => {
        if (cancelled) return;
        if ("error" in r) setRosterError(r.error);
        else setPlayers(r.players);
      })
      .catch(() => !cancelled && setRosterError("Couldn't load the rosters."));
    return () => {
      cancelled = true;
    };
  }, [hasRoster, league, game.homeTeam, game.awayTeam, attempt]);

  const position = players?.find((p) => p.name === playerName)?.position;
  const statOptions = hasRoster && !rosterError ? (position ? propTypesForPosition(league, position) : []) : GENERIC_PROP_TYPES;
  const yesNo = propType ? isYesNoPropType(propType) : false;

  return (
    <Question title={!playerName ? "Which player?" : !propType ? "Which stat?" : yesNo ? "Yes or no?" : "Over or under?"}>
      {hasRoster && !rosterError ? (
        <PlayerPropPicker
          league={league}
          players={players}
          loading={players === null}
          error={null}
          onRetry={() => setAttempt((a) => a + 1)}
          playerName={playerName}
          playerPosition={position}
          propType={propType}
          propTypeOptions={statOptions}
          onSelectPlayer={onPlayer}
          onClearPlayer={() => onPlayer("")}
          onSelectPropType={onPropType}
        />
      ) : (
        <>
          {rosterError && <p className="text-xs text-push">{rosterError} Type the player instead.</p>}
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            onBlur={() => typedName.trim() !== playerName && onPlayer(typedName.trim())}
            placeholder="Player name"
            autoComplete="off"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {statOptions.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!typedName.trim()}
                onClick={() => {
                  onPlayer(typedName.trim());
                  onPropType(t);
                }}
                className={`${chipClass(t === propType)} disabled:opacity-40`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            value={propType && !statOptions.includes(propType) ? propType : ""}
            onChange={(e) => {
              onPlayer(typedName.trim());
              onPropType(e.target.value);
            }}
            placeholder="…or type another stat"
            autoComplete="off"
            className={inputClass}
          />
        </>
      )}

      {playerName && propType && (
        <div className="grid grid-cols-2 gap-2">
          {(yesNo ? [Side.YES, Side.NO] : [Side.OVER, Side.UNDER]).map((s) => (
            <button key={s} type="button" onClick={() => onSide(s)} className={`${tileClass(side === s)} justify-center`}>
              <span className="font-display text-lg tracking-wide">{SIDE_LABEL[s]}</span>
            </button>
          ))}
        </div>
      )}
    </Question>
  );
}
