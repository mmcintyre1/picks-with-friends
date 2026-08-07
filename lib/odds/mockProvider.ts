import nflPropsChiefsBroncos from "./fixtures/nfl-props-evt_chiefs_broncos.json";
import nflSlate from "./fixtures/nfl-slate.json";
import type { OddsProvider, ProviderGame, ProviderProp, ProviderScore } from "./types";

const PROP_FIXTURES: Record<string, ProviderProp> = {
  evt_chiefs_broncos: nflPropsChiefsBroncos as ProviderProp,
};

// Deterministic, offline implementation used for all development and testing --
// ODDS_PROVIDER defaults to "mock" so no API key is needed to work on this app.
export function createMockProvider(): OddsProvider {
  return {
    async listGamesWithOdds(sportKey: string): Promise<ProviderGame[]> {
      // A league can map to multiple real sport keys (NFL preseason + regular season);
      // only return the fixture for one of them, mirroring how a real "off" key returns
      // an empty list -- otherwise every game would be duplicated once per queried key.
      if (sportKey !== "americanfootball_nfl") return [];
      // Fixtures aren't filtered by commenceFrom/To -- there's only ever one slate to
      // develop against, and real filtering only matters once real dates are involved.
      return nflSlate as ProviderGame[];
    },

    async listPlayerProps(_sportKey: string, eventId: string): Promise<ProviderProp> {
      const fixture = PROP_FIXTURES[eventId];
      if (fixture) return fixture;

      // A real game with no props posted looks the same way (empty bookmakers), not an
      // error -- this contract matters so the UI shows "no props available" not a crash.
      const game = (nflSlate as ProviderGame[]).find((g) => g.id === eventId);
      if (game) return { ...game, bookmakers: [] };

      return {
        id: eventId,
        sportKey: "americanfootball_nfl",
        sportTitle: "NFL",
        commenceTime: new Date().toISOString(),
        homeTeam: "Unknown",
        awayTeam: "Unknown",
        bookmakers: [],
      };
    },

    async getScores(): Promise<ProviderScore[]> {
      return [];
    },
  };
}
