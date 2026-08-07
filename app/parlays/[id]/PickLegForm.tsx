"use client";

import { useState, useTransition } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

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

const TEAM_MARKETS = new Set<Market>([Market.SPREAD, Market.TOTAL, Market.MONEYLINE]);

const fieldClass =
  "rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-subtle";

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

function slipToSelection(slip: Slip): TeamBetPick | PropPick | null {
  if (!slip.externalId) return null;
  const price = Number(slip.price);
  if (Number.isNaN(price)) return null;
  const line = slip.line ? Number(slip.line) : null;
  if (slip.kind === "team") {
    return {
      homeTeam: slip.homeTeam,
      awayTeam: slip.awayTeam,
      market: slip.market,
      side: slip.side,
      line,
      price,
      externalId: slip.externalId,
    };
  }
  return {
    homeTeam: slip.homeTeam,
    awayTeam: slip.awayTeam,
    market: slip.propShape === "yesNo" ? Market.PLAYER_PROP_YESNO : Market.PLAYER_PROP,
    side: slip.side,
    line,
    price,
    externalId: slip.externalId,
    playerName: slip.playerName,
    propType: slip.propType,
  };
}

const isSlipEmpty = (slip: Slip) =>
  !slip.homeTeam.trim() && !slip.awayTeam.trim() && !slip.price.trim() && !slip.externalId;

export function PickLegForm({
  parlayId,
  singleGame,
  usedGames,
  initial,
  liveOddsAvailable,
  league,
  onDone,
}: {
  parlayId: string;
  singleGame: boolean;
  usedGames: { homeTeam: string; awayTeam: string }[];
  initial?: Initial;
  liveOddsAvailable: boolean;
  league: string;
  onDone?: () => void;
}) {
  const [slip, setSlip] = useState<Slip>(() => slipFromInitial(initial));
  const [hadLiveLink, setHadLiveLink] = useState(false);
  const [entryMode, setEntryMode] = useState<"browse" | "manual">(liveOddsAvailable ? "browse" : "manual");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateHomeTeam(value: string) {
    setSlip((prev) => ({ ...prev, homeTeam: value, externalId: null }));
  }
  function updateAwayTeam(value: string) {
    setSlip((prev) => ({ ...prev, awayTeam: value, externalId: null }));
  }

  function setKind(kind: "team" | "prop") {
    setSlip((prev) => (kind === "team" ? emptyTeamSlip(prev) : emptyPropSlip(prev)));
    setHadLiveLink(false);
  }

  function clearSlip() {
    setSlip((prev) => (prev.kind === "team" ? emptyTeamSlip(prev) : emptyPropSlip(prev)));
    setHadLiveLink(false);
  }

  function onSelectTeamBet(pick: TeamBetPick) {
    setSlip({
      kind: "team",
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      market: pick.market,
      side: pick.side,
      line: pick.line?.toString() ?? "",
      price: pick.price.toString(),
      externalId: pick.externalId,
    });
    setHadLiveLink(true);
  }

  function onSelectProp(pick: PropPick) {
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
    setHadLiveLink(true);
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

  const selection = slipToSelection(slip);
  const teamSideOptions = slip.kind === "team" && slip.market === Market.TOTAL ? [Side.OVER, Side.UNDER] : [Side.HOME, Side.AWAY];

  return (
    <div className="flex flex-col gap-3">
      {!singleGame && usedGames.length > 0 && (
        <p className="text-xs text-muted">
          Already picked: {usedGames.map((g) => `${g.awayTeam} @ ${g.homeTeam}`).join(", ")}
        </p>
      )}

      {liveOddsAvailable && (
        <SegmentedControl
          size="sm"
          name="Entry mode"
          value={entryMode}
          onChange={setEntryMode}
          options={[
            { value: "browse", label: "Browse live odds" },
            { value: "manual", label: "Type it manually" },
          ]}
        />
      )}

      {liveOddsAvailable && entryMode === "browse" && (
        <LiveOddsBrowser league={league} onSelectTeamBet={onSelectTeamBet} onSelectProp={onSelectProp} selected={selection} />
      )}

      {/* Sticky rather than a modal -- this is the bet slip: it should stay reachable while
          you keep browsing games above it, snapping to the bottom of the screen once you've
          scrolled past its normal position, instead of interrupting browsing every click. */}
      <div className="sticky bottom-4 z-10">
        <Card className="flex flex-col gap-3 border-border-strong p-3 shadow-xl shadow-black/50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Your pick</p>
            <div className="flex items-center gap-2">
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
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={slip.awayTeam}
                onChange={(e) => updateAwayTeam(e.target.value)}
                placeholder="Away team"
                required
                autoComplete="off"
                className={fieldClass}
              />
              <input
                value={slip.homeTeam}
                onChange={(e) => updateHomeTeam(e.target.value)}
                placeholder="Home team"
                required
                autoComplete="off"
                className={fieldClass}
              />
            </div>

            {hadLiveLink && !slip.externalId && (
              <p className="text-xs text-pending">Unlinked from live odds — will save as manual entry.</p>
            )}

            {slip.kind === "team" ? (
              <>
                <div className="flex gap-2">
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
                <div className="flex gap-2">
                  <input
                    value={slip.playerName}
                    onChange={(e) => setSlip({ ...slip, playerName: e.target.value })}
                    placeholder="Player name"
                    autoComplete="off"
                    className={fieldClass}
                  />
                  <input
                    value={slip.propType}
                    onChange={(e) => setSlip({ ...slip, propType: e.target.value })}
                    placeholder="Stat (e.g. Passing Yards)"
                    autoComplete="off"
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
                  <div className="flex gap-2">
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
