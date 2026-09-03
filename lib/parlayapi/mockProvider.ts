import type { ParlayApiEvent, ParlayApiEventData, ParlayApiGameOdds, ParlayApiProp, ParlayApiProvider } from "./types";

// Fixture seeded from a real ParlayAPI capture (same Patriots @ Seahawks matchup the other
// two providers' mocks fixture, for a consistent side-by-side dev experience) -- not
// invented. ParlayAPI's own real event id for this matchup, confirmed via a live call.
//
// Enriched after a real usage comparison found the original one-pass version (5 players, 19
// rows) noticeably thinner than the other two providers' mocks, which had each been built up
// over several rounds this session -- every player/line/price below is a real, directly
// captured value from a deeper live pull (13 real players, real milestone ladders included),
// not a guess at parity.
const EVENT_ID = "1bb67464f064518614cf526e0af54269";
const HOME_TEAM = "Seattle Seahawks";
const AWAY_TEAM = "New England Patriots";
const COMMENCE_TIME = "2026-09-10T00:20:00.000Z";

function event(): ParlayApiEvent {
  return {
    id: EVENT_ID,
    canonical_event_id: "72fadaee48abb737",
    sport_key: "americanfootball_nfl",
    sport_title: "NFL",
    commence_time: COMMENCE_TIME,
    home_team: HOME_TEAM,
    away_team: AWAY_TEAM,
  };
}

function odds(): ParlayApiGameOdds {
  return {
    id: EVENT_ID,
    sport_key: "americanfootball_nfl",
    sport_title: "NFL",
    commence_time: COMMENCE_TIME,
    home_team: HOME_TEAM,
    away_team: AWAY_TEAM,
    bookmakers: [
      {
        key: "fanduel",
        title: "FanDuel",
        last_update: "2026-09-03T01:04:10Z",
        markets: [
          {
            key: "h2h",
            last_update: "2026-09-03T01:04:10Z",
            outcomes: [
              { name: HOME_TEAM, price: -198 },
              { name: AWAY_TEAM, price: 166 },
            ],
          },
          {
            key: "spreads",
            last_update: "2026-09-03T00:59:10Z",
            outcomes: [
              { name: HOME_TEAM, price: -112, point: -3.5 },
              { name: AWAY_TEAM, price: -108, point: 3.5 },
            ],
          },
          {
            key: "totals",
            last_update: "2026-09-03T00:58:53Z",
            outcomes: [
              { name: "Over", price: -110, point: 44.5 },
              { name: "Under", price: -110, point: 44.5 },
            ],
          },
        ],
      },
      {
        key: "draftkings",
        title: "DraftKings",
        last_update: "2026-09-03T00:58:53Z",
        markets: [
          {
            key: "h2h",
            last_update: "2026-09-03T00:58:53Z",
            outcomes: [
              { name: HOME_TEAM, price: -200 },
              { name: AWAY_TEAM, price: 165 },
            ],
          },
        ],
      },
      {
        key: "betmgm",
        title: "BetMGM",
        last_update: "2026-09-03T00:24:11Z",
        markets: [
          {
            key: "spreads",
            last_update: "2026-09-03T00:24:11Z",
            outcomes: [
              { name: HOME_TEAM, price: -110, point: -3 },
              { name: AWAY_TEAM, price: -110, point: 3 },
            ],
          },
        ],
      },
      {
        key: "caesars",
        title: "Caesars",
        last_update: "2026-09-03T00:08:38Z",
        markets: [
          {
            key: "totals",
            last_update: "2026-09-03T00:08:38Z",
            outcomes: [
              { name: "Over", price: -105, point: 45 },
              { name: "Under", price: -115, point: 45 },
            ],
          },
        ],
      },
    ],
  };
}

function prop(overrides: Partial<ParlayApiProp> & Pick<ParlayApiProp, "player" | "market_key" | "market" | "line" | "over_price" | "under_price">): ParlayApiProp {
  return {
    event_id: EVENT_ID,
    canonical_event_id: "72fadaee48abb737",
    sport_key: "americanfootball_nfl",
    game_date: "2026-09-10",
    home_team: HOME_TEAM,
    away_team: AWAY_TEAM,
    commence_time: COMMENCE_TIME,
    bookmaker: "fanduel",
    bookmaker_title: "FanDuel",
    implied_probability: 50,
    is_dfs_flat_payout: false,
    dfs_normalized: false,
    last_update: "2026-09-03T00:48:34Z",
    age_seconds: 1055.1,
    ...overrides,
  };
}

const CAESARS = { bookmaker: "caesars", bookmaker_title: "Caesars" };

// Real milestone-ladder tiers are the NORM in ParlayAPI's actual data, not the exception --
// a live pull confirmed nearly every player with a main receiving/rushing/passing-yards line
// also has 10-13 real tiered thresholds above it. Earlier versions of this fixture only gave
// the ladder treatment to one player per stat (a real usage gap the user caught by noticing
// only one real ladder rendered in the app) -- this generates the same shape for every player
// below from their own real captured tiers, instead of typing ~40 near-identical literals by
// hand. `tiers` are real {line, over, book} values pulled directly from the live event.
function ladder(
  player: string,
  statKey: "receiving_yards" | "rushing_yards" | "passing_yards",
  marketLabel: string,
  tiers: { line: number; over: number; book: string }[],
): ParlayApiProp[] {
  return tiers.map((t) =>
    prop({
      player,
      market_key: `player_${statKey}_milestones_${t.line}_or_more`,
      market: `${marketLabel} Milestones ${t.line} Or More`,
      line: t.line,
      over_price: t.over,
      under_price: null,
      bookmaker: t.book,
      bookmaker_title: t.book === "caesars" ? "Caesars" : t.book === "fanduel" ? "FanDuel" : t.book,
    }),
  );
}

const PROPS: ParlayApiProp[] = [
  // Drake Maye -- QB, full real spread including the combined pass+rush market and a real
  // 5-tier passing-yards ladder.
  prop({ player: "Drake Maye", market_key: "player_passing_yards", market: "Passing Yards", line: 226.5, over_price: -115, under_price: -114, ...CAESARS }),
  ...ladder("Drake Maye", "passing_yards", "Passing Yards", [
    { line: 200, over: -230, book: "caesars" },
    { line: 250, over: 131, book: "caesars" },
    { line: 275, over: 225, book: "fanduel" },
    { line: 300, over: 390, book: "caesars" },
    { line: 325, over: 680, book: "fanduel" },
  ]),
  prop({ player: "Drake Maye", market_key: "player_passing_tds", market: "Passing Tds", line: 1.5, over_price: 148, under_price: -197, ...CAESARS }),
  prop({ player: "Drake Maye", market_key: "player_passing_attempts", market: "Passing Attempts", line: 30.5, over_price: -130, under_price: -102 }),
  prop({ player: "Drake Maye", market_key: "player_pass_completions", market: "Pass Completions", line: 20.5, over_price: -102, under_price: -130 }),
  prop({ player: "Drake Maye", market_key: "player_rushing_yards", market: "Rushing Yards", line: 24.5, over_price: -118, under_price: -112, ...CAESARS }),
  ...ladder("Drake Maye", "rushing_yards", "Rushing Yards", [
    { line: 20, over: -176, book: "caesars" },
    { line: 30, over: 115, book: "caesars" },
    { line: 40, over: 220, book: "caesars" },
    { line: 60, over: 800, book: "fanduel" },
  ]),
  prop({ player: "Drake Maye", market_key: "player_rushing_attempts", market: "Rushing Attempts", line: 5.5, over_price: 106, under_price: -140 }),
  prop({ player: "Drake Maye", market_key: "player_passing_rushing_yards", market: "Passing + Rushing Yards", line: 261.5, over_price: -114, under_price: -114 }),
  prop({ player: "Drake Maye", market_key: "player_interceptions", market: "Interceptions", line: 0.5, over_price: -130, under_price: -102 }),
  prop({ player: "Drake Maye", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 360, under_price: null, ...CAESARS }),

  // Sam Darnold -- the other real QB on this event, same core spread.
  prop({ player: "Sam Darnold", market_key: "player_passing_yards", market: "Passing Yards", line: 228.5, over_price: -114, under_price: -115, ...CAESARS }),
  ...ladder("Sam Darnold", "passing_yards", "Passing Yards", [
    { line: 200, over: -240, book: "caesars" },
    { line: 250, over: 124, book: "caesars" },
    { line: 275, over: 255, book: "fanduel" },
    { line: 300, over: 375, book: "caesars" },
  ]),
  prop({ player: "Sam Darnold", market_key: "player_passing_tds", market: "Passing Tds", line: 1.5, over_price: 103, under_price: -134, ...CAESARS }),
  prop({ player: "Sam Darnold", market_key: "player_passing_attempts", market: "Passing Attempts", line: 29.5, over_price: -130, under_price: -102 }),
  prop({ player: "Sam Darnold", market_key: "player_pass_completions", market: "Pass Completions", line: 19.5, over_price: -130, under_price: -102 }),
  prop({ player: "Sam Darnold", market_key: "player_rushing_yards", market: "Rushing Yards", line: 5.5, over_price: -117, under_price: -113, ...CAESARS }),
  ...ladder("Sam Darnold", "rushing_yards", "Rushing Yards", [
    { line: 10, over: 128, book: "caesars" },
    { line: 15, over: 300, book: "fanduel" },
    { line: 20, over: 425, book: "caesars" },
  ]),
  prop({ player: "Sam Darnold", market_key: "player_passing_rushing_yards", market: "Passing + Rushing Yards", line: 236.5, over_price: -114, under_price: -114 }),
  prop({ player: "Sam Darnold", market_key: "player_interceptions", market: "Interceptions", line: 0.5, over_price: -130, under_price: -102 }),
  prop({ player: "Sam Darnold", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 900, under_price: null, ...CAESARS }),

  // Jaxon Smith-Njigba -- WR, real 6-tier receiving-yards ladder (the deepest real ladder
  // captured this session) plus receptions/longest/TD-scorer markets.
  prop({ player: "Jaxon Smith-Njigba", market_key: "player_receiving_yards", market: "Receiving Yards", line: 82.5, over_price: -115, under_price: -113, ...CAESARS }),
  ...ladder("Jaxon Smith-Njigba", "receiving_yards", "Receiving Yards", [
    { line: 60, over: -310, book: "caesars" },
    { line: 70, over: -200, book: "caesars" },
    { line: 80, over: -132, book: "caesars" },
    { line: 90, over: 114, book: "fanduel" },
    { line: 100, over: 162, book: "fanduel" },
    { line: 125, over: 360, book: "fanduel" },
  ]),
  prop({ player: "Jaxon Smith-Njigba", market_key: "player_receptions", market: "Receptions", line: 6.5, over_price: -105, under_price: -125, ...CAESARS }),
  prop({ player: "Jaxon Smith-Njigba", market_key: "player_longest_reception", market: "Longest Reception", line: 26.5, over_price: -112, under_price: -118 }),
  prop({ player: "Jaxon Smith-Njigba", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 120, under_price: null, ...CAESARS }),
  prop({ player: "Jaxon Smith-Njigba", market_key: "player_first_touchdown_scorer", market: "First Touchdown Scorer", line: 0, over_price: 700, under_price: null, ...CAESARS }),

  // A.J. Brown -- WR.
  prop({ player: "A.J. Brown", market_key: "player_receiving_yards", market: "Receiving Yards", line: 60.5, over_price: -118, under_price: -113, ...CAESARS }),
  ...ladder("A.J. Brown", "receiving_yards", "Receiving Yards", [
    { line: 40, over: -325, book: "caesars" },
    { line: 50, over: -179, book: "caesars" },
    { line: 70, over: 114, book: "caesars" },
    { line: 80, over: 148, book: "caesars" },
    { line: 100, over: 285, book: "caesars" },
  ]),
  prop({ player: "A.J. Brown", market_key: "player_receptions", market: "Receptions", line: 4.5, over_price: -148, under_price: 113, ...CAESARS }),
  prop({ player: "A.J. Brown", market_key: "player_longest_reception", market: "Longest Reception", line: 22.5, over_price: -114, under_price: -114 }),
  prop({ player: "A.J. Brown", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 160, under_price: null, ...CAESARS }),

  // Cooper Kupp -- WR.
  prop({ player: "Cooper Kupp", market_key: "player_receiving_yards", market: "Receiving Yards", line: 29.5, over_price: -112, under_price: -117, ...CAESARS }),
  ...ladder("Cooper Kupp", "receiving_yards", "Receiving Yards", [
    { line: 20, over: -300, book: "caesars" },
    { line: 40, over: 129, book: "caesars" },
    { line: 60, over: 370, book: "caesars" },
    { line: 80, over: 675, book: "caesars" },
    { line: 100, over: 1500, book: "fanduel" },
  ]),
  prop({ player: "Cooper Kupp", market_key: "player_receptions", market: "Receptions", line: 2.5, over_price: -148, under_price: 112, ...CAESARS }),
  prop({ player: "Cooper Kupp", market_key: "player_longest_reception", market: "Longest Reception", line: 16.5, over_price: -108, under_price: -122 }),
  prop({ player: "Cooper Kupp", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 225, under_price: null, ...CAESARS }),

  // Hunter Henry -- TE.
  prop({ player: "Hunter Henry", market_key: "player_receiving_yards", market: "Receiving Yards", line: 34.5, over_price: -117, under_price: -112, ...CAESARS }),
  ...ladder("Hunter Henry", "receiving_yards", "Receiving Yards", [
    { line: 20, over: -325, book: "caesars" },
    { line: 40, over: 105, book: "caesars" },
    { line: 60, over: 265, book: "caesars" },
    { line: 80, over: 700, book: "caesars" },
  ]),
  prop({ player: "Hunter Henry", market_key: "player_receptions", market: "Receptions", line: 3.5, over_price: 127, under_price: -170, ...CAESARS }),
  prop({ player: "Hunter Henry", market_key: "player_longest_reception", market: "Longest Reception", line: 17.5, over_price: -112, under_price: -118 }),
  prop({ player: "Hunter Henry", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 310, under_price: null, ...CAESARS }),

  // AJ Barner -- TE.
  prop({ player: "AJ Barner", market_key: "player_receiving_yards", market: "Receiving Yards", line: 24.5, over_price: -114, under_price: -114 }),
  ...ladder("AJ Barner", "receiving_yards", "Receiving Yards", [
    { line: 20, over: -200, book: "caesars" },
    { line: 30, over: 102, book: "caesars" },
    { line: 50, over: 390, book: "caesars" },
    { line: 70, over: 1200, book: "fanduel" },
  ]),
  prop({ player: "AJ Barner", market_key: "player_receptions", market: "Receptions", line: 2.5, over_price: -143, under_price: 110, ...CAESARS }),
  prop({ player: "AJ Barner", market_key: "player_longest_reception", market: "Longest Reception", line: 13.5, over_price: -108, under_price: -122 }),
  prop({ player: "AJ Barner", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 260, under_price: null, ...CAESARS }),

  // DeMario Douglas -- WR (real long-shot anytime-TD example).
  prop({ player: "DeMario Douglas", market_key: "player_receiving_yards", market: "Receiving Yards", line: 18.5, over_price: -112, under_price: -118, ...CAESARS }),
  ...ladder("DeMario Douglas", "receiving_yards", "Receiving Yards", [
    { line: 20, over: -118, book: "caesars" },
    { line: 30, over: 145, book: "caesars" },
    { line: 50, over: 500, book: "caesars" },
    { line: 70, over: 1200, book: "fanduel" },
  ]),
  prop({ player: "DeMario Douglas", market_key: "player_receptions", market: "Receptions", line: 1.5, over_price: -162, under_price: 123, ...CAESARS }),
  prop({ player: "DeMario Douglas", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 650, under_price: null, ...CAESARS }),

  // Rhamondre Stevenson -- RB, real 6-tier rushing-yards ladder plus the combined Rush + Rec
  // Yards market and the real Last Touchdown Scorer example.
  prop({ player: "Rhamondre Stevenson", market_key: "player_rushing_yards", market: "Rushing Yards", line: 41.5, over_price: -114, under_price: -114 }),
  ...ladder("Rhamondre Stevenson", "rushing_yards", "Rushing Yards", [
    { line: 30, over: -270, book: "caesars" },
    { line: 40, over: -130, book: "caesars" },
    { line: 50, over: 142, book: "caesars" },
    { line: 60, over: 235, book: "caesars" },
    { line: 70, over: 390, book: "caesars" },
    { line: 100, over: 1200, book: "fanduel" },
  ]),
  prop({ player: "Rhamondre Stevenson", market_key: "player_rushing_attempts", market: "Rushing Attempts", line: 11.5, over_price: -108, under_price: -122 }),
  prop({ player: "Rhamondre Stevenson", market_key: "player_rushing_receiving_yards", market: "Rushing + Receiving Yards", line: 64.5, over_price: -113, under_price: -115 }),
  prop({ player: "Rhamondre Stevenson", market_key: "player_receiving_yards", market: "Receiving Yards", line: 17.5, over_price: -120, under_price: -112, ...CAESARS }),
  ...ladder("Rhamondre Stevenson", "receiving_yards", "Receiving Yards", [
    { line: 10, over: -300, book: "caesars" },
    { line: 20, over: -108, book: "caesars" },
    { line: 30, over: 178, book: "caesars" },
    { line: 40, over: 350, book: "caesars" },
  ]),
  prop({ player: "Rhamondre Stevenson", market_key: "player_receptions", market: "Receptions", line: 2.5, over_price: 102, under_price: -137, ...CAESARS }),
  prop({ player: "Rhamondre Stevenson", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 145, under_price: null, ...CAESARS }),
  prop({ player: "Rhamondre Stevenson", market_key: "player_last_touchdown_scorer", market: "Last Touchdown Scorer", line: 0, over_price: 850, under_price: null, ...CAESARS }),

  // TreVeyon Henderson -- RB, plain rushing yards distinct from Stevenson's own line.
  prop({ player: "TreVeyon Henderson", market_key: "player_rushing_yards", market: "Rushing Yards", line: 29.5, over_price: -114, under_price: -114 }),
  ...ladder("TreVeyon Henderson", "rushing_yards", "Rushing Yards", [
    { line: 20, over: -325, book: "caesars" },
    { line: 30, over: -129, book: "caesars" },
    { line: 40, over: 151, book: "caesars" },
    { line: 60, over: 475, book: "caesars" },
  ]),
  prop({ player: "TreVeyon Henderson", market_key: "player_rushing_attempts", market: "Rushing Attempts", line: 8.5, over_price: -118, under_price: -112 }),
  prop({ player: "TreVeyon Henderson", market_key: "player_rushing_receiving_yards", market: "Rushing + Receiving Yards", line: 41.5, over_price: -114, under_price: -114 }),
  prop({ player: "TreVeyon Henderson", market_key: "player_receiving_yards", market: "Receiving Yards", line: 8.5, over_price: -110, under_price: -120, ...CAESARS }),
  ...ladder("TreVeyon Henderson", "receiving_yards", "Receiving Yards", [
    { line: 10, over: -110, book: "caesars" },
    { line: 20, over: 205, book: "caesars" },
    { line: 30, over: 500, book: "caesars" },
  ]),
  prop({ player: "TreVeyon Henderson", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 275, under_price: null, ...CAESARS }),

  // George Holani -- RB.
  prop({ player: "George Holani", market_key: "player_rushing_yards", market: "Rushing Yards", line: 18.5, over_price: -114, under_price: -114 }),
  ...ladder("George Holani", "rushing_yards", "Rushing Yards", [
    { line: 15, over: -178, book: "fanduel" },
    { line: 25, over: 152, book: "fanduel" },
    { line: 40, over: 295, book: "caesars" },
    { line: 60, over: 1100, book: "fanduel" },
  ]),
  prop({ player: "George Holani", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 225, under_price: null, ...CAESARS }),

  // Jadarian Price -- RB.
  prop({ player: "Jadarian Price", market_key: "player_rushing_yards", market: "Rushing Yards", line: 51.5, over_price: -117, under_price: -113, ...CAESARS }),
  ...ladder("Jadarian Price", "rushing_yards", "Rushing Yards", [
    { line: 30, over: -525, book: "caesars" },
    { line: 40, over: -250, book: "caesars" },
    { line: 60, over: 119, book: "caesars" },
    { line: 80, over: 285, book: "caesars" },
    { line: 100, over: 700, book: "caesars" },
  ]),
  prop({ player: "Jadarian Price", market_key: "player_rushing_attempts", market: "Rushing Attempts", line: 13.5, over_price: -102, under_price: -130 }),
  prop({ player: "Jadarian Price", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 118, under_price: null, ...CAESARS }),

  // Rashid Shaheed -- WR/RB hybrid usage, real combined rushing+receiving example.
  prop({ player: "Rashid Shaheed", market_key: "player_receiving_yards", market: "Receiving Yards", line: 31.5, over_price: -113, under_price: -115, ...CAESARS }),
  ...ladder("Rashid Shaheed", "receiving_yards", "Receiving Yards", [
    { line: 20, over: -275, book: "caesars" },
    { line: 40, over: 116, book: "caesars" },
    { line: 60, over: 260, book: "caesars" },
    { line: 80, over: 650, book: "caesars" },
    { line: 100, over: 1280, book: "fanduel" },
  ]),
  prop({ player: "Rashid Shaheed", market_key: "player_receptions", market: "Receptions", line: 2.5, over_price: 102, under_price: -137, ...CAESARS }),
  prop({ player: "Rashid Shaheed", market_key: "player_longest_reception", market: "Longest Reception", line: 17.5, over_price: -118, under_price: -112 }),
  prop({ player: "Rashid Shaheed", market_key: "player_rushing_yards", market: "Rushing Yards", line: 3.5, over_price: 116, under_price: -152, bookmaker: "caesars", bookmaker_title: "Caesars" }),
  prop({ player: "Rashid Shaheed", market_key: "player_rushing_receiving_yards", market: "Rushing + Receiving Yards", line: 37.5, over_price: -114, under_price: -114 }),
  prop({ player: "Rashid Shaheed", market_key: "player_anytime_touchdown_scorer", market: "Anytime Touchdown Scorer", line: 0, over_price: 285, under_price: null, ...CAESARS }),
];

// Deterministic, offline implementation for development/testing -- mirrors the other two
// providers' mock role for this vendor.
export function createMockParlayApiProvider(): ParlayApiProvider {
  return {
    async listNflSchedule() {
      return [event()];
    },
    async getNflEventOdds(eventId: string): Promise<ParlayApiEventData | null> {
      if (eventId !== EVENT_ID) return null;
      return { homeTeam: HOME_TEAM, awayTeam: AWAY_TEAM, commenceTime: COMMENCE_TIME, odds: odds(), props: PROPS };
    },
  };
}
