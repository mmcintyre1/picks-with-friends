import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRosterCacheForTests, createEspnProvider } from "./espnProvider";
import { RosterProviderError } from "./types";

function jsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), { status: init?.status ?? 200 });
}

describe("createEspnProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    __resetRosterCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the exact roster URL for a sport path + team id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ athletes: [] }));
    const provider = createEspnProvider();
    await provider.getRoster("football/nfl", "12");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12/roster",
    );
  });

  it("flattens every position group into a single player list (NFL/MLB/NHL grouped shape)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        athletes: [
          {
            position: "offense",
            items: [{ displayName: "Patrick Mahomes", position: { abbreviation: "QB" } }],
          },
          {
            position: "practiceSquad",
            items: [{ displayName: "Some Bench Guy", position: { abbreviation: "WR" } }],
          },
        ],
      }),
    );
    const provider = createEspnProvider();
    const players = await provider.getRoster("football/nfl", "12");

    expect(players).toEqual([
      { name: "Patrick Mahomes", position: "QB" },
      { name: "Some Bench Guy", position: "WR" },
    ]);
  });

  it("handles NBA's flat (ungrouped) roster shape", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        athletes: [
          { displayName: "Jayson Tatum", position: { abbreviation: "F" } },
          { displayName: "Derrick White", position: { abbreviation: "G" } },
        ],
      }),
    );
    const provider = createEspnProvider();
    const players = await provider.getRoster("basketball/nba", "2");

    expect(players).toEqual([
      { name: "Jayson Tatum", position: "F" },
      { name: "Derrick White", position: "G" },
    ]);
  });

  it("serves an identical request from cache instead of fetching again", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ athletes: [] }));
    const provider = createEspnProvider();

    await provider.getRoster("football/nfl", "12");
    await provider.getRoster("football/nfl", "12");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache across different team ids", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ athletes: [] })).mockResolvedValueOnce(jsonResponse({ athletes: [] }));
    const provider = createEspnProvider();

    await provider.getRoster("football/nfl", "12");
    await provider.getRoster("football/nfl", "7");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache across different sport paths, even with the same numeric team id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ athletes: [] })).mockResolvedValueOnce(jsonResponse({ athletes: [] }));
    const provider = createEspnProvider();

    await provider.getRoster("football/nfl", "1");
    await provider.getRoster("basketball/nba", "1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps a 404 to not_found", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 404 }));
    const provider = createEspnProvider();

    await expect(provider.getRoster("football/nfl", "bad-id")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("maps other non-ok statuses to upstream_error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));
    const provider = createEspnProvider();

    await expect(provider.getRoster("football/nfl", "12")).rejects.toBeInstanceOf(RosterProviderError);
    await expect(provider.getRoster("football/nfl", "12")).rejects.toMatchObject({ kind: "upstream_error" });
  });
});
