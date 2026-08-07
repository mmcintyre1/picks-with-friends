"use client";

import { useEffect, useState } from "react";

import { Market, Side } from "@/app/generated/prisma/enums";
import { getGameProps, getLiveGames } from "@/lib/odds/actions";
import {
  mapPropOutcomeToLegFields,
  mapTeamOutcomeToLegFields,
  pickPreferredBookmaker,
} from "@/lib/odds/mapping";
import type { ProviderGame, ProviderProp } from "@/lib/odds/types";

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

type MarketFilter = "spreads" | "totals" | "h2h" | "props";

const MARKET_FILTERS: { key: MarketFilter; label: string }[] = [
  { key: "spreads", label: "Spread" },
  { key: "totals", label: "Total" },
  { key: "h2h", label: "Moneyline" },
  { key: "props", label: "Props" },
];

const pillClass = (active: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs ${
    active
      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
      : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
  }`;

const chipClass =
  "rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900";

function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LiveOddsBrowser({
  league,
  onSelectTeamBet,
  onSelectProp,
}: {
  league: string;
  onSelectTeamBet: (pick: TeamBetPick) => void;
  onSelectProp: (pick: PropPick) => void;
}) {
  const [games, setGames] = useState<ProviderGame[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("spreads");
  const [propsByGame, setPropsByGame] = useState<Record<string, ProviderProp | "loading" | string>>({});

  useEffect(() => {
    let cancelled = false;
    getLiveGames(league).then((result) => {
      if (cancelled) return;
      if ("error" in result) setLoadError(result.error);
      else setGames(result.games);
    });
    return () => {
      cancelled = true;
    };
  }, [league]);

  async function loadProps(gameId: string, sportKey: string) {
    setPropsByGame((prev) => ({ ...prev, [gameId]: "loading" }));
    const result = await getGameProps(sportKey, gameId);
    setPropsByGame((prev) => ({
      ...prev,
      [gameId]: "error" in result ? result.error : result.props,
    }));
  }

  if (loadError) {
    return <p className="text-xs text-amber-500">{loadError} — use manual entry below.</p>;
  }
  if (games === null) {
    return <p className="text-xs text-gray-400">Loading live odds…</p>;
  }

  const search = teamFilter.trim().toLowerCase();
  const filteredGames = games.filter(
    (g) => !search || g.homeTeam.toLowerCase().includes(search) || g.awayTeam.toLowerCase().includes(search),
  );

  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-300 p-3 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          placeholder="Search team..."
          autoComplete="off"
          className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-transparent"
        />
        <div className="flex gap-1">
          {MARKET_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setMarketFilter(f.key)}
              className={pillClass(marketFilter === f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredGames.length === 0 && <p className="text-xs text-gray-400">No games match.</p>}

      <div className="flex flex-col gap-2">
        {filteredGames.map((game) => {
          const bookmaker = pickPreferredBookmaker(game);
          const market = bookmaker?.markets.find((m) => m.key === marketFilter);
          const propsState = propsByGame[game.id];

          return (
            <div key={game.id} className="flex flex-col gap-1.5 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-900">
              <p className="text-xs font-medium text-gray-500">
                {game.awayTeam} @ {game.homeTeam}
                <span className="ml-2 font-normal text-gray-400">{formatGameTime(game.commenceTime)}</span>
              </p>

              {marketFilter !== "props" ? (
                <div className="flex flex-wrap gap-1.5">
                  {market?.outcomes.length ? (
                    market.outcomes.map((outcome, i) => {
                      const mapped = mapTeamOutcomeToLegFields(marketFilter, outcome, game.homeTeam);
                      if (!mapped) return null;
                      const label =
                        marketFilter === "h2h"
                          ? `${outcome.name} ML (${outcome.price > 0 ? "+" : ""}${outcome.price})`
                          : `${outcome.name} ${outcome.point! > 0 ? "+" : ""}${outcome.point} (${outcome.price > 0 ? "+" : ""}${outcome.price})`;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            onSelectTeamBet({
                              homeTeam: game.homeTeam,
                              awayTeam: game.awayTeam,
                              market: mapped.market,
                              side: mapped.side,
                              line: mapped.line,
                              price: outcome.price,
                              externalId: game.id,
                            })
                          }
                          className={chipClass}
                        >
                          {label}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-400">No line posted.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {!propsState && (
                    <button type="button" onClick={() => loadProps(game.id, game.sportKey)} className={chipClass}>
                      Load props
                    </button>
                  )}
                  {propsState === "loading" && <p className="text-xs text-gray-400">Loading props…</p>}
                  {typeof propsState === "string" && propsState !== "loading" && (
                    <p className="text-xs text-amber-500">{propsState}</p>
                  )}
                  {propsState && typeof propsState === "object" && (
                    <div className="flex flex-wrap gap-1.5">
                      {propsState.bookmakers.flatMap((b) => b.markets).flatMap((m) => m.outcomes).length === 0 ? (
                        <p className="text-xs text-gray-400">No props posted for this game.</p>
                      ) : (
                        propsState.bookmakers
                          .flatMap((b) => b.markets)
                          .flatMap((m) => m.outcomes.map((outcome) => ({ marketKey: m.key, outcome })))
                          .map(({ marketKey, outcome }, i) => {
                            const mapped = mapPropOutcomeToLegFields(marketKey, outcome);
                            if (!mapped) return null;
                            const label =
                              mapped.market === Market.PLAYER_PROP_YESNO
                                ? `${mapped.playerName} ${mapped.propType} — ${outcome.name} (${outcome.price > 0 ? "+" : ""}${outcome.price})`
                                : `${mapped.playerName} ${mapped.propType} ${outcome.name} ${mapped.line} (${outcome.price > 0 ? "+" : ""}${outcome.price})`;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() =>
                                  onSelectProp({
                                    homeTeam: game.homeTeam,
                                    awayTeam: game.awayTeam,
                                    market: mapped.market,
                                    side: mapped.side,
                                    line: mapped.line,
                                    price: outcome.price,
                                    externalId: game.id,
                                    playerName: mapped.playerName,
                                    propType: mapped.propType,
                                  })
                                }
                                className={chipClass}
                              >
                                {label}
                              </button>
                            );
                          })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
