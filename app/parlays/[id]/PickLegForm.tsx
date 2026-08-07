"use client";

import { useState, useTransition } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";

import { pickLeg } from "../actions";
import { LiveOddsBrowser, type PropPick, type TeamBetPick } from "./LiveOddsBrowser";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  line: number | null;
  price: number | null;
  playerName: string | null;
  propType: string | null;
};

const selectClass =
  "rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-transparent";

const TEAM_MARKETS = new Set<Market>([Market.SPREAD, Market.TOTAL, Market.MONEYLINE]);

function initialPickKind(market?: Market): "team" | "prop" {
  return market && !TEAM_MARKETS.has(market) ? "prop" : "team";
}

function initialPropShape(market?: Market): "overUnder" | "yesNo" {
  return market === Market.PLAYER_PROP_YESNO ? "yesNo" : "overUnder";
}

// "HOME"/"AWAY" on their own don't say which team that is -- show the actual team name
// once one's been entered, falling back to the literal side name until then.
function sideLabel(side: Side, homeTeam: string, awayTeam: string): string {
  if (side === Side.HOME) return homeTeam.trim() || "Home";
  if (side === Side.AWAY) return awayTeam.trim() || "Away";
  return side === Side.OVER ? "Over" : "Under";
}

export function PickLegForm({
  parlayId,
  singleGame,
  usedGames,
  initial,
  liveOddsAvailable,
  league,
}: {
  parlayId: string;
  singleGame: boolean;
  usedGames: { homeTeam: string; awayTeam: string }[];
  initial?: Initial;
  liveOddsAvailable: boolean;
  league: string;
}) {
  const [homeTeam, setHomeTeam] = useState(initial?.homeTeam ?? "");
  const [awayTeam, setAwayTeam] = useState(initial?.awayTeam ?? "");
  const [pickKind, setPickKind] = useState<"team" | "prop">(initialPickKind(initial?.market));
  const [entryMode, setEntryMode] = useState<"browse" | "manual">(liveOddsAvailable ? "browse" : "manual");
  const [externalId, setExternalId] = useState<string | null>(null);

  // Team-bet fields
  const [market, setMarket] = useState<Market>(
    initial && TEAM_MARKETS.has(initial.market) ? initial.market : Market.SPREAD,
  );
  const [side, setSide] = useState<Side>(
    initial && TEAM_MARKETS.has(initial.market) ? initial.side : Side.HOME,
  );

  // Player-prop fields
  const [propShape, setPropShape] = useState<"overUnder" | "yesNo">(initialPropShape(initial?.market));
  const [playerName, setPlayerName] = useState(initial?.playerName ?? "");
  const [propType, setPropType] = useState(initial?.propType ?? "");
  const [propSide, setPropSide] = useState<Side>(
    initial && !TEAM_MARKETS.has(initial.market) ? initial.side : Side.OVER,
  );

  const [line, setLine] = useState(initial?.line?.toString() ?? "");
  const [price, setPrice] = useState(initial?.price?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const teamSideOptions = market === Market.TOTAL ? [Side.OVER, Side.UNDER] : [Side.HOME, Side.AWAY];

  // externalId is only trustworthy if the team names still match what a live-odds click
  // set it from -- if the user hand-edits either team after that, drop it rather than
  // risk attaching the wrong provider event id to a different matchup.
  function updateHomeTeam(value: string) {
    setHomeTeam(value);
    setExternalId(null);
  }
  function updateAwayTeam(value: string) {
    setAwayTeam(value);
    setExternalId(null);
  }

  function onSelectTeamBet(pick: TeamBetPick) {
    setAwayTeam(pick.awayTeam);
    setHomeTeam(pick.homeTeam);
    setPickKind("team");
    setMarket(pick.market);
    setSide(pick.side);
    setLine(pick.line?.toString() ?? "");
    setPrice(pick.price.toString());
    setExternalId(pick.externalId);
  }

  function onSelectProp(pick: PropPick) {
    setAwayTeam(pick.awayTeam);
    setHomeTeam(pick.homeTeam);
    setPickKind("prop");
    setPropShape(pick.market === Market.PLAYER_PROP_YESNO ? "yesNo" : "overUnder");
    setPropSide(pick.side);
    setPlayerName(pick.playerName);
    setPropType(pick.propType);
    setLine(pick.line?.toString() ?? "");
    setPrice(pick.price.toString());
    setExternalId(pick.externalId);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const resolvedMarket =
      pickKind === "team" ? market : propShape === "overUnder" ? Market.PLAYER_PROP : Market.PLAYER_PROP_YESNO;
    const resolvedSide = pickKind === "team" ? side : propSide;

    startTransition(async () => {
      const result = await pickLeg(parlayId, {
        homeTeam,
        awayTeam,
        market: resolvedMarket,
        side: resolvedSide,
        line: pickKind === "prop" && propShape === "yesNo" ? "" : line,
        price,
        playerName: pickKind === "prop" ? playerName : "",
        propType: pickKind === "prop" ? propType : "",
        externalId: externalId ?? "",
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 rounded-md border border-gray-300 p-3 dark:border-gray-700"
    >
      {!singleGame && usedGames.length > 0 && (
        <p className="text-xs text-gray-400">
          Already picked: {usedGames.map((g) => `${g.awayTeam} @ ${g.homeTeam}`).join(", ")}
        </p>
      )}

      {liveOddsAvailable && (
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setEntryMode("browse")}
            className={`rounded-full px-2 py-1 ${entryMode === "browse" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-gray-300 dark:border-gray-700"}`}
          >
            Browse live odds
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("manual")}
            className={`rounded-full px-2 py-1 ${entryMode === "manual" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-gray-300 dark:border-gray-700"}`}
          >
            Type it manually
          </button>
        </div>
      )}

      {liveOddsAvailable && entryMode === "browse" && (
        <LiveOddsBrowser league={league} onSelectTeamBet={onSelectTeamBet} onSelectProp={onSelectProp} />
      )}

      <div className="flex gap-2">
        <input
          value={awayTeam}
          onChange={(e) => updateAwayTeam(e.target.value)}
          placeholder="Away team"
          required
          autoComplete="off"
          className={selectClass}
        />
        <input
          value={homeTeam}
          onChange={(e) => updateHomeTeam(e.target.value)}
          placeholder="Home team"
          required
          autoComplete="off"
          className={selectClass}
        />
      </div>

      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setPickKind("team")}
          className={`rounded-full px-2 py-1 ${pickKind === "team" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-gray-300 dark:border-gray-700"}`}
        >
          Team bet
        </button>
        <button
          type="button"
          onClick={() => setPickKind("prop")}
          className={`rounded-full px-2 py-1 ${pickKind === "prop" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-gray-300 dark:border-gray-700"}`}
        >
          Player prop
        </button>
      </div>

      {pickKind === "team" ? (
        <>
          <div className="flex gap-2">
            <select
              value={market}
              onChange={(e) => {
                const m = e.target.value as Market;
                setMarket(m);
                setSide(m === Market.TOTAL ? Side.OVER : Side.HOME);
              }}
              className={selectClass}
            >
              <option value={Market.SPREAD}>Spread</option>
              <option value={Market.TOTAL}>Total</option>
              <option value={Market.MONEYLINE}>Moneyline</option>
            </select>
            <select value={side} onChange={(e) => setSide(e.target.value as Side)} className={selectClass}>
              {teamSideOptions.map((s) => (
                <option key={s} value={s}>
                  {sideLabel(s, homeTeam, awayTeam)}
                </option>
              ))}
            </select>
          </div>
          {market !== Market.MONEYLINE && (
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="Line (e.g. -3.5)"
              autoComplete="off"
              className={selectClass}
            />
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Player name"
              autoComplete="off"
              className={selectClass}
            />
            <input
              value={propType}
              onChange={(e) => setPropType(e.target.value)}
              placeholder="Stat (e.g. Passing Yards)"
              autoComplete="off"
              className={selectClass}
            />
          </div>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setPropShape("overUnder");
                setPropSide(Side.OVER);
              }}
              className={`rounded-full px-2 py-1 ${propShape === "overUnder" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-gray-300 dark:border-gray-700"}`}
            >
              Over/Under
            </button>
            <button
              type="button"
              onClick={() => {
                setPropShape("yesNo");
                setPropSide(Side.YES);
              }}
              className={`rounded-full px-2 py-1 ${propShape === "yesNo" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-gray-300 dark:border-gray-700"}`}
            >
              Yes/No
            </button>
          </div>
          {propShape === "overUnder" ? (
            <div className="flex gap-2">
              <select
                value={propSide}
                onChange={(e) => setPropSide(e.target.value as Side)}
                className={selectClass}
              >
                <option value={Side.OVER}>Over</option>
                <option value={Side.UNDER}>Under</option>
              </select>
              <input
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="Line (e.g. 250.5)"
                autoComplete="off"
                className={selectClass}
              />
            </div>
          ) : (
            <select
              value={propSide}
              onChange={(e) => setPropSide(e.target.value as Side)}
              className={selectClass}
            >
              <option value={Side.YES}>Yes</option>
              <option value={Side.NO}>No</option>
            </select>
          )}
        </>
      )}

      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Odds (e.g. -110)"
        required
        autoComplete="off"
        className={selectClass}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : initial ? "Update pick" : "Lock in pick"}
      </button>
    </form>
  );
}
