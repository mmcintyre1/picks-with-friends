import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetScheduleCacheForTests, createEspnScheduleProvider } from "./espnProvider";
import { ScheduleProviderError } from "./types";

function jsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), { status: init?.status ?? 200 });
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

  it("builds the exact scoreboard URL with a whole-date range", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [] }));
    const provider = createEspnScheduleProvider();
    await provider.listUpcomingGames("NBA", {
      commenceFrom: new Date("2026-08-07T12:00:00Z"),
      commenceTo: new Date("2026-08-15T00:00:00Z"),
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
    );
    expect(url.searchParams.get("dates")).toBe("20260807-20260815");
  });

  it("maps home/away competitors into a ScheduleGame", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        events: [
          {
            id: "401902644",
            date: "2026-10-03T23:00Z",
            competitions: [
              {
                competitors: [
                  { homeAway: "home", team: { displayName: "Toronto Raptors" } },
                  { homeAway: "away", team: { displayName: "Miami Heat" } },
                ],
              },
            ],
          },
        ],
      }),
    );
    const provider = createEspnScheduleProvider();
    const games = await provider.listUpcomingGames("NBA", {
      commenceFrom: new Date(),
      commenceTo: new Date(),
    });

    expect(games).toEqual([
      { id: "401902644", league: "NBA", commenceTime: "2026-10-03T23:00Z", homeTeam: "Toronto Raptors", awayTeam: "Miami Heat" },
    ]);
  });

  it("serves an identical request from cache instead of fetching again", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [] }));
    const provider = createEspnScheduleProvider();
    const opts = { commenceFrom: new Date("2026-08-07"), commenceTo: new Date("2026-08-15") };

    await provider.listUpcomingGames("MLB", opts);
    await provider.listUpcomingGames("MLB", opts);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a non-ok status to upstream_error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));
    const provider = createEspnScheduleProvider();

    await expect(
      provider.listUpcomingGames("NHL", { commenceFrom: new Date(), commenceTo: new Date() }),
    ).rejects.toBeInstanceOf(ScheduleProviderError);
  });
});
