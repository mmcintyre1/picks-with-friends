import type { SportsGameOddsEvent, SportsGameOddsOdd, SportsGameOddsProvider } from "./types";

// Fixture seeded from real SportsGameOdds responses captured during Phase 2.19
// implementation (the same Patriots @ Seahawks event lib/sharpapi/mockProvider.ts already
// fixtures, for a consistent side-by-side dev experience) -- not invented. Covers real
// confirmed shapes: team-level game lines, passing/receiving/rushing player props, the
// combined Rush + Rec Yards market, and both the Over/Under and Yes/No touchdown shapes.
//
// Enriched in a Phase 2.19 follow-up after a real deeper pull on this same event found 27
// distinct statIDs (versus the ~10 the original fixture covered) -- every player id/name
// below is a real one confirmed present on this event's actual roster, not invented; the
// specific odds/lines are representative values in each market's real confirmed shape,
// not necessarily the literal live number at capture time.
const EVENT_ID = "z95b2JMJVRm8HrjOKHFS";

function odd(overrides: Partial<SportsGameOddsOdd> & Pick<SportsGameOddsOdd, "oddID" | "statID" | "betTypeID" | "sideID" | "byBookmaker">): SportsGameOddsOdd {
  return {
    marketName: overrides.oddID,
    statEntityID: overrides.playerID ?? overrides.sideID,
    periodID: "game",
    ...overrides,
  };
}

const ODDS: SportsGameOddsOdd[] = [
  // Team-level game lines
  odd({
    oddID: "points-away-game-ml-away",
    statID: "points",
    betTypeID: "ml",
    sideID: "away",
    byBookmaker: { draftkings: { odds: "+150", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "points-home-game-ml-home",
    statID: "points",
    betTypeID: "ml",
    sideID: "home",
    byBookmaker: { draftkings: { odds: "-180", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "points-away-game-sp-away",
    statID: "points",
    betTypeID: "sp",
    sideID: "away",
    byBookmaker: {
      draftkings: {
        odds: "-115",
        overUnder: "3.5",
        available: true,
        lastUpdatedAt: "2026-09-02T00:00:00Z",
        altLines: [{ odds: "-220", overUnder: "7", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" }],
      },
    },
  }),
  odd({
    oddID: "points-home-game-sp-home",
    statID: "points",
    betTypeID: "sp",
    sideID: "home",
    byBookmaker: {
      draftkings: {
        odds: "-105",
        overUnder: "3.5",
        available: true,
        lastUpdatedAt: "2026-09-02T00:00:00Z",
        altLines: [{ odds: "+175", overUnder: "7", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" }],
      },
    },
  }),
  odd({
    oddID: "points-away-game-ou-over",
    statID: "points",
    betTypeID: "ou",
    sideID: "over",
    byBookmaker: { draftkings: { odds: "-110", overUnder: "44.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "points-away-game-ou-under",
    statID: "points",
    betTypeID: "ou",
    sideID: "under",
    byBookmaker: { draftkings: { odds: "-110", overUnder: "44.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Drake Maye -- QB, gets the full real spread of markets confirmed this session.
  odd({
    oddID: "passing_yards-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "passing_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "-113", overUnder: "224.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "passing_yards-DRAKE_MAYE_1_NFL-game-ou-under",
    statID: "passing_yards",
    betTypeID: "ou",
    sideID: "under",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "-111", overUnder: "224.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "passing_touchdowns-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "passing_touchdowns",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "+139", overUnder: "1.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "passing_touchdowns-DRAKE_MAYE_1_NFL-game-ou-under",
    statID: "passing_touchdowns",
    betTypeID: "ou",
    sideID: "under",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "-178", overUnder: "1.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "passing_touchdowns-DRAKE_MAYE_1_NFL-game-yn-yes",
    statID: "passing_touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "-413", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-DRAKE_MAYE_1_NFL-game-yn-yes",
    statID: "touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "+370", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "touchdowns",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "+3500", overUnder: "1.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "firstTouchdown-DRAKE_MAYE_1_NFL-game-yn-yes",
    statID: "firstTouchdown",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { draftkings: { odds: "+1900", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Jaxon Smith-Njigba -- WR, receiving + rushing+receiving combined market.
  odd({
    oddID: "receiving_yards-JAXON_SMITHNJIGBA_1_NFL-game-ou-over",
    statID: "receiving_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "JAXON_SMITHNJIGBA_1_NFL",
    byBookmaker: { draftkings: { odds: "-112", overUnder: "85.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "receiving_yards-JAXON_SMITHNJIGBA_1_NFL-game-ou-under",
    statID: "receiving_yards",
    betTypeID: "ou",
    sideID: "under",
    playerID: "JAXON_SMITHNJIGBA_1_NFL",
    byBookmaker: { draftkings: { odds: "-108", overUnder: "85.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "receiving_receptions-JAXON_SMITHNJIGBA_1_NFL-game-ou-over",
    statID: "receiving_receptions",
    betTypeID: "ou",
    sideID: "over",
    playerID: "JAXON_SMITHNJIGBA_1_NFL",
    byBookmaker: { draftkings: { odds: "-108", overUnder: "6.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "receiving_receptions-JAXON_SMITHNJIGBA_1_NFL-game-ou-under",
    statID: "receiving_receptions",
    betTypeID: "ou",
    sideID: "under",
    playerID: "JAXON_SMITHNJIGBA_1_NFL",
    byBookmaker: { draftkings: { odds: "-118", overUnder: "6.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-JAXON_SMITHNJIGBA_1_NFL-game-yn-yes",
    statID: "touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "JAXON_SMITHNJIGBA_1_NFL",
    byBookmaker: { draftkings: { odds: "+125", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Rhamondre Stevenson -- RB, the real confirmed Rush + Rec Yards market.
  odd({
    oddID: "rushing+receiving_yards-RHAMONDRE_STEVENSON_1_NFL-game-ou-over",
    statID: "rushing+receiving_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "RHAMONDRE_STEVENSON_1_NFL",
    byBookmaker: { draftkings: { odds: "-111", overUnder: "60.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "rushing+receiving_yards-RHAMONDRE_STEVENSON_1_NFL-game-ou-under",
    statID: "rushing+receiving_yards",
    betTypeID: "ou",
    sideID: "under",
    playerID: "RHAMONDRE_STEVENSON_1_NFL",
    byBookmaker: { draftkings: { odds: "-115", overUnder: "60.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-RHAMONDRE_STEVENSON_1_NFL-game-yn-yes",
    statID: "touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "RHAMONDRE_STEVENSON_1_NFL",
    byBookmaker: { draftkings: { odds: "+135", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "rushing_longestRush-RHAMONDRE_STEVENSON_1_NFL-game-ou-over",
    statID: "rushing_longestRush",
    betTypeID: "ou",
    sideID: "over",
    playerID: "RHAMONDRE_STEVENSON_1_NFL",
    byBookmaker: { fanduel: { odds: "-115", overUnder: "16.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Drake Maye also gets the additional real markets confirmed in the deeper pull.
  odd({
    oddID: "passing_attempts-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "passing_attempts",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { fanduel: { odds: "-127", overUnder: "30.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "passing_completions-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "passing_completions",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { fanduel: { odds: "+100", overUnder: "20.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "rushing_attempts-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "rushing_attempts",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { fanduel: { odds: "+106", overUnder: "5.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "passing+rushing_yards-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "passing+rushing_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: {
      fanduel: {
        odds: "-114",
        overUnder: "236.5",
        available: true,
        lastUpdatedAt: "2026-09-02T00:00:00Z",
        altLines: [{ odds: "+118", overUnder: "249.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" }],
      },
    },
  }),
  odd({
    oddID: "passing_interceptions-DRAKE_MAYE_1_NFL-game-ou-over",
    statID: "passing_interceptions",
    betTypeID: "ou",
    sideID: "over",
    playerID: "DRAKE_MAYE_1_NFL",
    byBookmaker: { fanduel: { odds: "-105", overUnder: "0.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Sam Darnold -- the other real QB on this event, same core passing spread.
  odd({
    oddID: "passing_yards-SAM_DARNOLD_1_NFL-game-ou-over",
    statID: "passing_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "SAM_DARNOLD_1_NFL",
    byBookmaker: { draftkings: { odds: "-110", overUnder: "245.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-SAM_DARNOLD_1_NFL-game-yn-yes",
    statID: "touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "SAM_DARNOLD_1_NFL",
    byBookmaker: { draftkings: { odds: "+425", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Cooper Kupp -- WR, receiving + longest reception.
  odd({
    oddID: "receiving_yards-COOPER_KUPP_1_NFL-game-ou-over",
    statID: "receiving_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "COOPER_KUPP_1_NFL",
    byBookmaker: { draftkings: { odds: "-110", overUnder: "58.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "receiving_receptions-COOPER_KUPP_1_NFL-game-ou-over",
    statID: "receiving_receptions",
    betTypeID: "ou",
    sideID: "over",
    playerID: "COOPER_KUPP_1_NFL",
    byBookmaker: { draftkings: { odds: "-115", overUnder: "5.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "receiving_longestReception-JAXON_SMITHNJIGBA_1_NFL-game-ou-over",
    statID: "receiving_longestReception",
    betTypeID: "ou",
    sideID: "over",
    playerID: "JAXON_SMITHNJIGBA_1_NFL",
    byBookmaker: { fanduel: { odds: "-118", overUnder: "22.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Hunter Henry -- TE, receiving.
  odd({
    oddID: "receiving_yards-HUNTER_HENRY_1_NFL-game-ou-over",
    statID: "receiving_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "HUNTER_HENRY_1_NFL",
    byBookmaker: { draftkings: { odds: "-112", overUnder: "38.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-HUNTER_HENRY_1_NFL-game-yn-yes",
    statID: "touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "HUNTER_HENRY_1_NFL",
    byBookmaker: { draftkings: { odds: "+240", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // TreVeyon Henderson -- RB, plain rushing yards (distinct from Stevenson's combo market).
  odd({
    oddID: "rushing_yards-TREVEYON_HENDERSON_1_NFL-game-ou-over",
    statID: "rushing_yards",
    betTypeID: "ou",
    sideID: "over",
    playerID: "TREVEYON_HENDERSON_1_NFL",
    byBookmaker: { draftkings: { odds: "-108", overUnder: "42.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "touchdowns-TREVEYON_HENDERSON_1_NFL-game-yn-yes",
    statID: "touchdowns",
    betTypeID: "yn",
    sideID: "yes",
    playerID: "TREVEYON_HENDERSON_1_NFL",
    byBookmaker: { draftkings: { odds: "+150", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Jason Myers -- K, the real confirmed Kicking category (empty for both books on the real
  // live pull this fixture is otherwise seeded from -- these values are representative of
  // the real market shape once a book actually posts a kicker line, not a literal capture).
  odd({
    oddID: "kicking_totalPoints-JASON_MYERS_1_NFL-game-ou-over",
    statID: "kicking_totalPoints",
    betTypeID: "ou",
    sideID: "over",
    playerID: "JASON_MYERS_1_NFL",
    byBookmaker: { draftkings: { odds: "-115", overUnder: "6.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "fieldGoals_made-JASON_MYERS_1_NFL-game-ou-over",
    statID: "fieldGoals_made",
    betTypeID: "ou",
    sideID: "over",
    playerID: "JASON_MYERS_1_NFL",
    byBookmaker: { draftkings: { odds: "+105", overUnder: "1.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "extraPoints_kicksMade-JASON_MYERS_1_NFL-game-ou-over",
    statID: "extraPoints_kicksMade",
    betTypeID: "ou",
    sideID: "over",
    playerID: "JASON_MYERS_1_NFL",
    byBookmaker: { draftkings: { odds: "-120", overUnder: "2.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),

  // Robert Spillane -- LB, the real confirmed Defense category (same real-shape-not-
  // literal-capture caveat as the kicker rows above).
  odd({
    oddID: "defense_combinedTackles-ROBERT_SPILLANE_1_NFL-game-ou-over",
    statID: "defense_combinedTackles",
    betTypeID: "ou",
    sideID: "over",
    playerID: "ROBERT_SPILLANE_1_NFL",
    byBookmaker: { draftkings: { odds: "-110", overUnder: "7.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "defense_soloTackles-ROBERT_SPILLANE_1_NFL-game-ou-over",
    statID: "defense_soloTackles",
    betTypeID: "ou",
    sideID: "over",
    playerID: "ROBERT_SPILLANE_1_NFL",
    byBookmaker: { draftkings: { odds: "-105", overUnder: "4.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
  odd({
    oddID: "defense_assistedTackles-BYRON_MURPHY_1_NFL-game-ou-over",
    statID: "defense_assistedTackles",
    betTypeID: "ou",
    sideID: "over",
    playerID: "BYRON_MURPHY_1_NFL",
    byBookmaker: { draftkings: { odds: "+100", overUnder: "1.5", available: true, lastUpdatedAt: "2026-09-02T00:00:00Z" } },
  }),
];

function buildEvent(): SportsGameOddsEvent {
  return {
    eventID: EVENT_ID,
    sportID: "FOOTBALL",
    leagueID: "NFL",
    teams: {
      home: { teamID: "SEATTLE_SEAHAWKS_NFL", names: { long: "Seattle Seahawks", medium: "Seahawks", short: "SEA" } },
      away: { teamID: "NEW_ENGLAND_PATRIOTS_NFL", names: { long: "New England Patriots", medium: "Patriots", short: "NE" } },
    },
    status: { startsAt: "2026-09-10T00:20:00Z", oddsAvailable: true },
    players: {
      DRAKE_MAYE_1_NFL: { playerID: "DRAKE_MAYE_1_NFL", name: "Drake Maye" },
      JAXON_SMITHNJIGBA_1_NFL: { playerID: "JAXON_SMITHNJIGBA_1_NFL", name: "Jaxon Smith-Njigba" },
      RHAMONDRE_STEVENSON_1_NFL: { playerID: "RHAMONDRE_STEVENSON_1_NFL", name: "Rhamondre Stevenson" },
      SAM_DARNOLD_1_NFL: { playerID: "SAM_DARNOLD_1_NFL", name: "Sam Darnold" },
      COOPER_KUPP_1_NFL: { playerID: "COOPER_KUPP_1_NFL", name: "Cooper Kupp" },
      HUNTER_HENRY_1_NFL: { playerID: "HUNTER_HENRY_1_NFL", name: "Hunter Henry" },
      TREVEYON_HENDERSON_1_NFL: { playerID: "TREVEYON_HENDERSON_1_NFL", name: "TreVeyon Henderson" },
      JASON_MYERS_1_NFL: { playerID: "JASON_MYERS_1_NFL", name: "Jason Myers" },
      ROBERT_SPILLANE_1_NFL: { playerID: "ROBERT_SPILLANE_1_NFL", name: "Robert Spillane" },
      BYRON_MURPHY_1_NFL: { playerID: "BYRON_MURPHY_1_NFL", name: "Byron Murphy" },
    },
    odds: Object.fromEntries(ODDS.map((o) => [o.oddID, o])),
  };
}

// Deterministic, offline implementation for development/testing -- mirrors
// lib/sharpapi/mockProvider.ts's role for this provider.
export function createMockSportsGameOddsProvider(): SportsGameOddsProvider {
  const event = buildEvent();
  return {
    async listNflSchedule() {
      return [event];
    },
    async getNflEventOdds(eventId: string) {
      return eventId === EVENT_ID ? event : null;
    },
  };
}
