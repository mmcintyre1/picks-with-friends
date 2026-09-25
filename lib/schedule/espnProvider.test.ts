import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetScheduleCacheForTests, createEspnScheduleProvider } from "./espnProvider";
import { ScheduleProviderError } from "./types";

function jsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), { status: init?.status ?? 200 });
}

function rawEvent(id: string, date: string, home: string, away: string) {
  return {
    id,
    date,
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { displayName: home } },
          { homeAway: "away", team: { displayName: away } },
        ],
      },
    ],
  };
}

describe("createEspnScheduleProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    __resetScheduleCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list without fetching for a league with no roster/schedule mapping", async () => {
    const provider = createEspnScheduleProvider();
    const games = await provider.listUpcomingGames("SOCCER");

    expect(games).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the default scoreboard when no window is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [] }));
    await createEspnScheduleProvider().listUpcomingGames("NFL");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  });

  it("fetches one single-day request per day (ESPN rejects date ranges), starting a day early", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ events: [] }));
    await createEspnScheduleProvider().listUpcomingGames("NBA", {
      commenceFrom: new Date("2026-08-07T12:00:00Z"),
      commenceTo: new Date("2026-08-09T00:00:00Z"),
    });

    const dates = fetchMock.mock.calls.map((call) => {
      const url = new URL(call[0]);
      expect(url.origin + url.pathname).toBe("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
      return url.searchParams.get("dates");
    });
    expect(dates).toEqual(["20260806", "20260807", "20260808", "20260809"]);
    expect(dates.some((d) => d?.includes("-"))).toBe(false);
  });

  it("maps home/away competitors into a ScheduleGame", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ events: [rawEvent("401902644", "2026-10-03T23:00Z", "Toronto Raptors", "Miami Heat")] }),
    );
    const provider = createEspnScheduleProvider();
    const from = new Date("2026-10-03T12:00:00Z");
    const games = await provider.listUpcomingGames("NBA", { commenceFrom: from, commenceTo: from });

    expect(games).toEqual([
      { id: "401902644", league: "NBA", commenceTime: "2026-10-03T23:00Z", homeTeam: "Toronto Raptors", awayTeam: "Miami Heat" },
    ]);
  });

  it("merges days, dedupes a game returned by more than one day, and sorts by start time", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const day = new URL(url).searchParams.get("dates");
      if (day === "20261002") return jsonResponse({ events: [rawEvent("b", "2026-10-03T01:00Z", "H2", "A2")] });
      if (day === "20261003") {
        return jsonResponse({ events: [rawEvent("b", "2026-10-03T01:00Z", "H2", "A2"), rawEvent("a", "2026-10-02T23:00Z", "H1", "A1")] });
      }
      return jsonResponse({ events: [] });
    });
    const games = await createEspnScheduleProvider().listUpcomingGames("NFL", {
      commenceFrom: new Date("2026-10-03T12:00:00Z"),
      commenceTo: new Date("2026-10-03T12:00:00Z"),
    });

    expect(games.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("keeps the days that worked when one day fails", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (new URL(url).searchParams.get("dates") === "20261002") return jsonResponse({}, { status: 500 });
      return jsonResponse({ events: [rawEvent("a", "2026-10-03T23:00Z", "H", "A")] });
    });
    const games = await createEspnScheduleProvider().listUpcomingGames("NFL", {
      commenceFrom: new Date("2026-10-03T12:00:00Z"),
      commenceTo: new Date("2026-10-03T12:00:00Z"),
    });

    expect(games).toHaveLength(1);
  });

  it("serves an identical request from cache instead of fetching again", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ events: [] }));
    const provider = createEspnScheduleProvider();
    const opts = { commenceFrom: new Date("2026-08-07"), commenceTo: new Date("2026-08-08") };

    await provider.listUpcomingGames("MLB", opts);
    const callsAfterFirst = fetchMock.mock.calls.length;
    await provider.listUpcomingGames("MLB", opts);

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it("throws upstream_error when every day fails", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, { status: 500 }));
    const provider = createEspnScheduleProvider();

    await expect(
      provider.listUpcomingGames("NHL", { commenceFrom: new Date(), commenceTo: new Date() }),
    ).rejects.toBeInstanceOf(ScheduleProviderError);
  });
});
