import nflPropsChiefsBroncos from "./fixtures/nfl-props-evt_chiefs_broncos.json";
import nflSlate from "./fixtures/nfl-slate.json";
import type {
  OddsProvider,
  ProviderBookmaker,
  ProviderEvent,
  ProviderGame,
  ProviderProp,
  ProviderScore,
} from "./types";

const SLATE = nflSlate as ProviderGame[];
const PROP_FIXTURES: Record<string, ProviderProp> = {
  evt_chiefs_broncos: nflPropsChiefsBroncos as ProviderProp,
};

// Deterministic, offline implementation used for all development and testing --
// ODDS_PROVIDER defaults to "mock" so no API key is needed to work on this app.
export function createMockProvider(): OddsProvider {
  return {
    async listEvents(sportKey: string): Promise<ProviderEvent[]> {
      // A league can map to multiple real sport keys (NFL preseason + regular season);
      // only return the fixture for one of them, mirroring how a real "off" key returns
      // an empty list -- otherwise every game would be duplicated once per queried key.
      if (sportKey !== "americanfootball_nfl") return [];
      return SLATE.map((g) => ({
        id: g.id,
        sportKey: g.sportKey,
        commenceTime: g.commenceTime,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
      }));
    },

    async getEventOdds(_sportKey: string, eventId: string, markets: string[]): Promise<ProviderProp> {
      const game = SLATE.find((g) => g.id === eventId);
      const propsFixture = PROP_FIXTURES[eventId];
      const base = game ?? propsFixture;

      if (!base) {
        // A real game with no odds posted for the requested markets looks the same way
        // (empty bookmakers), not an error -- this contract matters so the UI shows
        // "nothing available" rather than crashing.
        return {
          id: eventId,
          sportKey: "americanfootball_nfl",
          sportTitle: "NFL",
          commenceTime: new Date().toISOString(),
          homeTeam: "Unknown",
          awayTeam: "Unknown",
          bookmakers: [],
        };
      }

      // Merge the game's team-market bookmakers with the props fixture's bookmakers (if
      // any), then filter down to just the requested markets -- mirrors how the real
      // per-event endpoint only returns markets that were both asked for and have data.
      const merged = new Map<string, ProviderBookmaker>();
      for (const b of game?.bookmakers ?? []) merged.set(b.key, { ...b, markets: [...b.markets] });
      for (const b of propsFixture?.bookmakers ?? []) {
        const existing = merged.get(b.key);
        if (existing) existing.markets.push(...b.markets);
        else merged.set(b.key, { ...b, markets: [...b.markets] });
      }

      const bookmakers = Array.from(merged.values())
        .map((b) => ({ ...b, markets: b.markets.filter((m) => markets.includes(m.key)) }))
        .filter((b) => b.markets.length > 0);

      return { ...base, bookmakers };
    },

    async getScores(): Promise<ProviderScore[]> {
      return [];
    },
  };
}
