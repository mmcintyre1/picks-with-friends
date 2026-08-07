import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PROP_MARKETS, TEAM_MARKETS } from "./mapping";
import { __resetOddsCacheForTests, createTheOddsApiProvider } from "./theOddsApiProvider";
import { OddsProviderError } from "./types";

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

describe("createTheOddsApiProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // The request cache is module-level state -- without this, one test's cached
    // response could leak into the next test that builds an identical request URL.
    __resetOddsCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws missing_key immediately when no API key is configured, without fetching", () => {
    expect(() => createTheOddsApiProvider("")).toThrow(OddsProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves an identical request from cache instead of fetching again", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const provider = createTheOddsApiProvider("test-key");

    await provider.listEvents("americanfootball_nfl");
    await provider.listEvents("americanfootball_nfl");
    await provider.listEvents("americanfootball_nfl");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache across different request params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([]));
    const provider = createTheOddsApiProvider("test-key");

    await provider.listEvents("americanfootball_nfl");
    await provider.listEvents("americanfootball_nfl_preseason");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("builds the exact (free, no markets/regions/bookmakers) events URL/params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const provider = createTheOddsApiProvider("test-key");
    await provider.listEvents("americanfootball_nfl");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/",
    );
    expect(url.searchParams.get("apiKey")).toBe("test-key");
    expect(url.searchParams.has("markets")).toBe(false);
    expect(url.searchParams.has("regions")).toBe(false);
    expect(url.searchParams.has("bookmakers")).toBe(false);
  });

  it("omits commenceTimeFrom/To when no date range is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const provider = createTheOddsApiProvider("test-key");
    await provider.listEvents("americanfootball_nfl");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.has("commenceTimeFrom")).toBe(false);
    expect(url.searchParams.has("commenceTimeTo")).toBe(false);
  });

  it("passes commenceTimeFrom/To as whole-second ISO timestamps when given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const provider = createTheOddsApiProvider("test-key");
    await provider.listEvents("americanfootball_nfl", {
      commenceFrom: new Date("2026-09-11T00:00:00.123Z"),
      commenceTo: new Date("2026-09-19T00:00:00.456Z"),
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("commenceTimeFrom")).toBe("2026-09-11T00:00:00Z");
    expect(url.searchParams.get("commenceTimeTo")).toBe("2026-09-19T00:00:00Z");
  });

  it("maps a raw snake_case event response to ProviderEvent", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "evt_1",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-14T20:20:00Z",
          home_team: "Chiefs",
          away_team: "Broncos",
        },
      ]),
    );
    const provider = createTheOddsApiProvider("test-key");
    const events = await provider.listEvents("americanfootball_nfl");

    expect(events).toEqual([
      {
        id: "evt_1",
        sportKey: "americanfootball_nfl",
        commenceTime: "2026-09-14T20:20:00Z",
        homeTeam: "Chiefs",
        awayTeam: "Broncos",
      },
    ]);
  });

  it("builds the exact per-event odds URL/params for team markets", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "evt_1",
        sport_key: "americanfootball_nfl",
        sport_title: "NFL",
        commence_time: "2026-09-14T20:20:00Z",
        home_team: "Chiefs",
        away_team: "Broncos",
        bookmakers: [],
      }),
    );
    const provider = createTheOddsApiProvider("test-key");
    await provider.getEventOdds("americanfootball_nfl", "evt_1", TEAM_MARKETS);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/evt_1/odds/",
    );
    expect(url.searchParams.get("markets")).toBe("h2h,spreads,totals");
    expect(url.searchParams.get("bookmakers")).toBe("draftkings,fanduel,betmgm,caesars");
  });

  it("builds the exact per-event odds URL/params for prop markets", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "evt_1",
        sport_key: "americanfootball_nfl",
        sport_title: "NFL",
        commence_time: "2026-09-14T20:20:00Z",
        home_team: "Chiefs",
        away_team: "Broncos",
        bookmakers: [],
      }),
    );
    const provider = createTheOddsApiProvider("test-key");
    await provider.getEventOdds("americanfootball_nfl", "evt_1", DEFAULT_PROP_MARKETS);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("markets")).toBe(
      "player_pass_yds,player_rush_yds,player_reception_yds,player_anytime_td",
    );
  });

  it("maps a raw snake_case game response to ProviderGame", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "evt_1",
        sport_key: "americanfootball_nfl",
        sport_title: "NFL",
        commence_time: "2026-09-14T20:20:00Z",
        home_team: "Chiefs",
        away_team: "Broncos",
        bookmakers: [
          {
            key: "draftkings",
            title: "DraftKings",
            last_update: "2026-09-14T19:00:00Z",
            markets: [
              {
                key: "h2h",
                last_update: "2026-09-14T19:00:00Z",
                outcomes: [{ name: "Chiefs", price: -260 }],
              },
            ],
          },
        ],
      }),
    );
    const provider = createTheOddsApiProvider("test-key");
    const odds = await provider.getEventOdds("americanfootball_nfl", "evt_1", TEAM_MARKETS);

    expect(odds).toEqual({
      id: "evt_1",
      sportKey: "americanfootball_nfl",
      sportTitle: "NFL",
      commenceTime: "2026-09-14T20:20:00Z",
      homeTeam: "Chiefs",
      awayTeam: "Broncos",
      bookmakers: [
        {
          key: "draftkings",
          title: "DraftKings",
          lastUpdate: "2026-09-14T19:00:00Z",
          markets: [
            {
              key: "h2h",
              lastUpdate: "2026-09-14T19:00:00Z",
              outcomes: [{ name: "Chiefs", price: -260 }],
            },
          ],
        },
      ],
    });
  });

  it("maps a 401 to an upstream_error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "bad key" }, { status: 401 }));
    const provider = createTheOddsApiProvider("test-key");

    await expect(provider.listEvents("americanfootball_nfl")).rejects.toMatchObject({
      kind: "upstream_error",
    });
  });

  it("maps a 429 to quota_exceeded", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 429 }));
    const provider = createTheOddsApiProvider("test-key");

    await expect(provider.listEvents("americanfootball_nfl")).rejects.toMatchObject({
      kind: "quota_exceeded",
    });
  });

  it("maps a 404 to not_found", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 404 }));
    const provider = createTheOddsApiProvider("test-key");

    await expect(
      provider.getEventOdds("americanfootball_nfl", "bad-id", TEAM_MARKETS),
    ).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});
