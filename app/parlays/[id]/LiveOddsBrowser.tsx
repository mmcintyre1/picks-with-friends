"use client";

import { useEffect, useState } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatGameTime } from "@/lib/formatGameTime";
import { getGameOdds, getGameProps, getUpcomingGames } from "@/lib/odds/actions";
import {
  mapPropOutcomeToLegFields,
  mapTeamOutcomeToLegFields,
  pickPreferredBookmaker,
} from "@/lib/odds/mapping";
import type { ProviderEvent, ProviderProp } from "@/lib/odds/types";

export type TeamBetPick = {
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  line: number | null;
  price: number;
  externalId: string;
};

export type PropPick = TeamBetPick & { playerName: string; propType: string };

type TeamMarketKey = "spreads" | "totals" | "h2h";

const TEAM_MARKET_TABS: { value: TeamMarketKey; label: string }[] = [
  { value: "spreads", label: "Spread" },
  { value: "totals", label: "Total" },
  { value: "h2h", label: "Moneyline" },
];

function formatPrice(price: number): string {
  return `${price > 0 ? "+" : ""}${price}`;
}

// Only the fields that make two selections "the same bet" for highlighting purposes --
// price can drift between loads without it counting as a different selection.
function isSameSelection(
  candidate: TeamBetPick | PropPick,
  selected: (TeamBetPick | PropPick) | null,
): boolean {
  if (!selected) return false;
  if (candidate.externalId !== selected.externalId) return false;
  if (candidate.market !== selected.market) return false;
  if (candidate.side !== selected.side) return false;
  if ((candidate.line ?? null) !== (selected.line ?? null)) return false;
  if ("playerName" in candidate || "playerName" in selected) {
    return (
      "playerName" in candidate &&
      "playerName" in selected &&
      candidate.playerName === selected.playerName &&
      candidate.propType === selected.propType
    );
  }
  return true;
}

const outcomeButtonClass = (active: boolean) =>
  `flex min-w-[6.5rem] flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
    active
      ? "border-accent bg-accent/15 text-foreground"
      : "border-border bg-card-elevated text-foreground hover:border-border-strong"
  }`;

type LoadState = "loading" | ProviderProp | string; // string = error message

export function LiveOddsBrowser({
  league,
  onSelectTeamBet,
  onSelectProp,
  selected,
}: {
  league: string;
  onSelectTeamBet: (pick: TeamBetPick) => void;
  onSelectProp: (pick: PropPick) => void;
  selected: (TeamBetPick | PropPick) | null;
}) {
  const [games, setGames] = useState<ProviderEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [oddsByGame, setOddsByGame] = useState<Record<string, LoadState>>({});
  const [propsByGame, setPropsByGame] = useState<Record<string, LoadState>>({});
  const [marketTabByGame, setMarketTabByGame] = useState<Record<string, TeamMarketKey>>({});
  const [oddsOpen, setOddsOpen] = useState<Record<string, boolean>>({});
  const [propsOpen, setPropsOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // This call is free (no markets requested) -- safe to fetch automatically. Odds
    // themselves are never fetched until the user clicks "Show odds" on a specific game.
    let cancelled = false;
    getUpcomingGames(league).then((result) => {
      if (cancelled) return;
      if ("error" in result) setLoadError(result.error);
      else setGames(result.games);
    });
    return () => {
      cancelled = true;
    };
  }, [league]);

  async function loadOdds(gameId: string, sportKey: string) {
    setOddsOpen((prev) => ({ ...prev, [gameId]: true }));
    if (oddsByGame[gameId]) return;
    setOddsByGame((prev) => ({ ...prev, [gameId]: "loading" }));
    const result = await getGameOdds(sportKey, gameId);
    setOddsByGame((prev) => ({ ...prev, [gameId]: "error" in result ? result.error : result.odds }));
    setMarketTabByGame((prev) => ({ ...prev, [gameId]: prev[gameId] ?? "spreads" }));
  }

  async function loadProps(gameId: string, sportKey: string) {
    setPropsOpen((prev) => ({ ...prev, [gameId]: true }));
    if (propsByGame[gameId]) return;
    setPropsByGame((prev) => ({ ...prev, [gameId]: "loading" }));
    const result = await getGameProps(sportKey, gameId);
    setPropsByGame((prev) => ({ ...prev, [gameId]: "error" in result ? result.error : result.props }));
  }

  if (loadError) {
    return <p className="text-xs text-push">{loadError} — use manual entry below.</p>;
  }
  if (games === null) {
    return <p className="text-xs text-muted">Loading schedule…</p>;
  }

  const search = teamFilter.trim().toLowerCase();
  const filteredGames = games.filter(
    (g) => !search || g.homeTeam.toLowerCase().includes(search) || g.awayTeam.toLowerCase().includes(search),
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        value={teamFilter}
        onChange={(e) => setTeamFilter(e.target.value)}
        placeholder="Search team..."
        autoComplete="off"
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-subtle"
      />

      {filteredGames.length === 0 && <p className="text-xs text-muted">No games match.</p>}

      <div className="flex flex-col gap-2">
        {filteredGames.map((game) => {
          const odds = oddsByGame[game.id];
          const props = propsByGame[game.id];
          const activeTab = marketTabByGame[game.id] ?? "spreads";
          const bookmaker = typeof odds === "object" ? pickPreferredBookmaker(odds) : null;
          const market = bookmaker?.markets.find((m) => m.key === activeTab);
          const isOddsOpen = oddsOpen[game.id] ?? false;
          const isPropsOpen = propsOpen[game.id] ?? false;

          return (
            <Card key={game.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {game.awayTeam} <span className="text-subtle">@</span> {game.homeTeam}
                </p>
                <span className="text-xs text-muted">{formatGameTime(game.commenceTime)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    isOddsOpen ? setOddsOpen((p) => ({ ...p, [game.id]: false })) : loadOdds(game.id, game.sportKey)
                  }
                  className="rounded-md border border-border-strong px-2.5 py-1 text-xs text-muted hover:text-foreground"
                >
                  {isOddsOpen ? "Hide odds" : "Show odds"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isPropsOpen
                      ? setPropsOpen((p) => ({ ...p, [game.id]: false }))
                      : loadProps(game.id, game.sportKey)
                  }
                  className="rounded-md border border-border-strong px-2.5 py-1 text-xs text-muted hover:text-foreground"
                >
                  {isPropsOpen ? "Hide props" : "Load props"}
                </button>
              </div>

              {isOddsOpen && odds === "loading" && <p className="text-xs text-muted">Loading odds…</p>}
              {isOddsOpen && typeof odds === "string" && odds !== "loading" && (
                <p className="text-xs text-push">{odds}</p>
              )}
              {isOddsOpen && odds && typeof odds === "object" && (
                <div className="flex flex-col gap-2">
                  <SegmentedControl
                    size="sm"
                    name={`Market for ${game.awayTeam} @ ${game.homeTeam}`}
                    value={activeTab}
                    onChange={(v) => setMarketTabByGame((prev) => ({ ...prev, [game.id]: v }))}
                    options={TEAM_MARKET_TABS}
                  />
                  <div className="flex flex-wrap gap-2">
                    {market?.outcomes.length ? (
                      market.outcomes.map((outcome, i) => {
                        const mapped = mapTeamOutcomeToLegFields(activeTab, outcome, game.homeTeam);
                        if (!mapped) return null;
                        const pick: TeamBetPick = {
                          homeTeam: game.homeTeam,
                          awayTeam: game.awayTeam,
                          market: mapped.market,
                          side: mapped.side,
                          line: mapped.line,
                          price: outcome.price,
                          externalId: game.id,
                        };
                        const topLabel =
                          activeTab === "h2h"
                            ? `${outcome.name} ML`
                            : `${outcome.name} ${outcome.point! > 0 ? "+" : ""}${outcome.point}`;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSelectTeamBet(pick)}
                            className={outcomeButtonClass(isSameSelection(pick, selected))}
                          >
                            <span className="font-medium">{topLabel}</span>
                            <span className="font-display text-sm tracking-wide text-accent tabular-nums">
                              {formatPrice(outcome.price)}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted">No line posted for this market.</p>
                    )}
                  </div>
                </div>
              )}

              {isPropsOpen && props === "loading" && <p className="text-xs text-muted">Loading props…</p>}
              {isPropsOpen && typeof props === "string" && props !== "loading" && (
                <p className="text-xs text-push">{props}</p>
              )}
              {isPropsOpen && props && typeof props === "object" && (
                <div className="flex flex-wrap gap-2">
                  {props.bookmakers.flatMap((b) => b.markets).flatMap((m) => m.outcomes).length === 0 ? (
                    <p className="text-xs text-muted">No props posted for this game.</p>
                  ) : (
                    props.bookmakers
                      .flatMap((b) => b.markets)
                      .flatMap((m) => m.outcomes.map((outcome) => ({ marketKey: m.key, outcome })))
                      .map(({ marketKey, outcome }, i) => {
                        const mapped = mapPropOutcomeToLegFields(marketKey, outcome);
                        if (!mapped) return null;
                        const pick: PropPick = {
                          homeTeam: game.homeTeam,
                          awayTeam: game.awayTeam,
                          market: mapped.market,
                          side: mapped.side,
                          line: mapped.line,
                          price: outcome.price,
                          externalId: game.id,
                          playerName: mapped.playerName,
                          propType: mapped.propType,
                        };
                        const topLabel =
                          mapped.market === Market.PLAYER_PROP_YESNO
                            ? `${mapped.playerName} ${mapped.propType} — ${outcome.name}`
                            : `${mapped.playerName} ${mapped.propType} ${outcome.name} ${mapped.line}`;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSelectProp(pick)}
                            className={outcomeButtonClass(isSameSelection(pick, selected))}
                          >
                            <span className="font-medium">{topLabel}</span>
                            <span className="font-display text-sm tracking-wide text-accent tabular-nums">
                              {formatPrice(outcome.price)}
                            </span>
                          </button>
                        );
                      })
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
