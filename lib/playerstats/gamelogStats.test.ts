import { describe, expect, it } from "vitest";

import { Side } from "@/app/generated/prisma/enums";

import { average, extractGameLog, filterByOpponent, gamelogStatKeys, hitRate, isHit, normalizePlayerName } from "./gamelogStats";
import type { EspnGameLogResponse } from "./types";

function response(names: string[], games: { eventId: string; date: string; opp: string; atVs: string; stats: string[] }[]): EspnGameLogResponse {
  return {
    names,
    labels: names,
    events: Object.fromEntries(games.map((g) => [g.eventId, { id: g.eventId, gameDate: g.date, atVs: g.atVs, opponent: { abbreviation: g.opp } }])),
    seasonTypes: [{ displayName: "2025", categories: [{ events: games.map((g) => ({ eventId: g.eventId, stats: g.stats })) }] }],
  };
}

describe("gamelogStatKeys", () => {
  it("maps confirmed real propTypes to their gamelog column(s)", () => {
    expect(gamelogStatKeys("NFL", "Receiving Yards")).toEqual(["receivingYards"]);
    expect(gamelogStatKeys("NFL", "Rush + Rec Yards")).toEqual(["rushingYards", "receivingYards"]);
  });

  it("returns undefined for a propType with no confirmed gamelog mapping (e.g. 1st TD Scorer)", () => {
    expect(gamelogStatKeys("NFL", "1st TD Scorer")).toBeUndefined();
  });
});

describe("extractGameLog", () => {
  it("reads the single-column stat at the right positional index, newest game first", () => {
    const res = response(["receptions", "receivingYards"], [
      { eventId: "e1", date: "2025-11-01", opp: "DAL", atVs: "vs", stats: ["5", "60"] },
      { eventId: "e2", date: "2025-11-08", opp: "NYG", atVs: "@", stats: ["3", "40"] },
    ]);
    const entries = extractGameLog(res, ["receivingYards"]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ date: "2025-11-08", opponent: "NYG", isHome: false, value: 40 });
    expect(entries[1]).toMatchObject({ date: "2025-11-01", opponent: "DAL", isHome: true, value: 60 });
  });

  it("sums multiple columns for a combined stat (Rush + Rec Yards)", () => {
    const res = response(["rushingYards", "receivingYards"], [{ eventId: "e1", date: "2025-11-01", opp: "DAL", atVs: "vs", stats: ["30", "45"] }]);
    expect(extractGameLog(res, ["rushingYards", "receivingYards"])[0].value).toBe(75);
  });

  it("drops a game where every needed column is '-' (player didn't record the stat) rather than counting it as a real zero", () => {
    const res = response(["receivingYards"], [
      { eventId: "e1", date: "2025-11-01", opp: "DAL", atVs: "vs", stats: ["-"] },
      { eventId: "e2", date: "2025-11-08", opp: "NYG", atVs: "vs", stats: ["0"] },
    ]);
    const entries = extractGameLog(res, ["receivingYards"]);
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toBe(0);
  });

  it("returns [] when none of the requested columns exist in this athlete's log (e.g. asking a QB about Receiving Yards)", () => {
    const res = response(["passingYards"], [{ eventId: "e1", date: "2025-11-01", opp: "DAL", atVs: "vs", stats: ["250"] }]);
    expect(extractGameLog(res, ["receivingYards"])).toEqual([]);
  });

  it("de-duplicates an event id repeated across season types/categories", () => {
    const res: EspnGameLogResponse = {
      names: ["receivingYards"],
      labels: ["receivingYards"],
      events: { e1: { id: "e1", gameDate: "2025-11-01", atVs: "vs", opponent: { abbreviation: "DAL" } } },
      seasonTypes: [
        { displayName: "a", categories: [{ events: [{ eventId: "e1", stats: ["50"] }] }] },
        { displayName: "b", categories: [{ events: [{ eventId: "e1", stats: ["50"] }] }] },
      ],
    };
    expect(extractGameLog(res, ["receivingYards"])).toHaveLength(1);
  });
});

describe("isHit", () => {
  it("Over/Yes clinches at or above the line", () => {
    expect(isHit(100, 100, Side.OVER)).toBe(true);
    expect(isHit(99, 100, Side.OVER)).toBe(false);
  });

  it("Under/No clinches strictly below the line", () => {
    expect(isHit(99, 100, Side.UNDER)).toBe(true);
    expect(isHit(100, 100, Side.UNDER)).toBe(false);
  });
});

describe("hitRate", () => {
  // Newest-first, matching extractGameLog's own real ordering: e1 (most recent) hit, e2 and
  // e3 (oldest) both missed -- deliberately not a palindrome, so a reversal bug (or a
  // no-op that skips reversing) would actually be caught below.
  const entries = [
    { eventId: "e1", date: "2025-12-01", opponent: "A", isHome: true, value: 80 },
    { eventId: "e2", date: "2025-11-24", opponent: "B", isHome: false, value: 40 },
    { eventId: "e3", date: "2025-11-17", opponent: "C", isHome: true, value: 40 },
  ];

  it("computes hits/games/pct over the requested window", () => {
    expect(hitRate(entries, 60.5, Side.OVER, 3)).toEqual({ hits: 1, games: 3, pct: 33.3, results: [false, false, true] });
  });

  it("orders `results` oldest-to-newest, the opposite of `entries`' own newest-first order", () => {
    // entries are [newest hit, miss, oldest miss] -- results should read [oldest miss, miss, newest hit].
    expect(hitRate(entries, 60.5, Side.OVER, 3)!.results).toEqual([false, false, true]);
  });

  it("caps the window at however many real games exist", () => {
    expect(hitRate(entries, 60.5, Side.OVER, 10)).toEqual({ hits: 1, games: 3, pct: 33.3, results: [false, false, true] });
  });

  it("returns null when there is no history at all", () => {
    expect(hitRate([], 60.5, Side.OVER, 10)).toBeNull();
  });
});

describe("filterByOpponent", () => {
  const entries = [
    { eventId: "e1", date: "2025-12-01", opponent: "SEA", isHome: true, value: 80 },
    { eventId: "e2", date: "2025-11-24", opponent: "CLE", isHome: false, value: 40 },
    { eventId: "e3", date: "2025-11-17", opponent: "SEA", isHome: false, value: 60 },
  ];

  it("keeps only real games against the given opponent, preserving order", () => {
    expect(filterByOpponent(entries, "SEA")).toEqual([entries[0], entries[2]]);
  });

  it("returns [] for an opponent never played", () => {
    expect(filterByOpponent(entries, "BUF")).toEqual([]);
  });
});

describe("average", () => {
  it("rounds to one decimal place", () => {
    const entries = [
      { eventId: "e1", date: "2025-12-01", opponent: "A", isHome: true, value: 10 },
      { eventId: "e2", date: "2025-11-24", opponent: "B", isHome: false, value: 21 },
    ];
    expect(average(entries)).toBe(15.5);
  });

  it("returns null for an empty list rather than a misleading 0", () => {
    expect(average([])).toBeNull();
  });
});

describe("normalizePlayerName", () => {
  it("collapses real formatting mismatches between a roster name and a prop's own player string", () => {
    expect(normalizePlayerName("AJ Barner")).toBe(normalizePlayerName("A.J. Barner"));
    expect(normalizePlayerName("Jaxon Smith-Njigba")).toBe(normalizePlayerName("Jaxon Smith Njigba"));
  });

  it("strips a trailing generational suffix so a vendor's unsuffixed name still matches ESPN's suffixed one", () => {
    expect(normalizePlayerName("Byron Murphy")).toBe(normalizePlayerName("Byron Murphy II"));
    expect(normalizePlayerName("Kenneth Walker")).toBe(normalizePlayerName("Kenneth Walker III"));
    expect(normalizePlayerName("Odell Beckham")).toBe(normalizePlayerName("Odell Beckham Jr."));
  });
});
