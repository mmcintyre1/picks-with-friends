import "dotenv/config";

import type { User } from "../app/generated/prisma/client";
import { Badge, LegResult, Market, ParlayStatus, Side } from "../app/generated/prisma/enums";
import { prisma } from "../lib/prisma";

async function main() {
  const group = await prisma.group.upsert({
    where: { id: "seed-group" },
    update: {},
    create: { id: "seed-group", name: "The Group" },
  });

  // Usernames only -- no PIN is set here. Each friend claims their PIN on first
  // sign-in via the login screen's claim step. Rename these to real usernames
  // whenever you're ready (re-running this script is safe, it upserts by username).
  const usernames = ["friend1", "friend2", "friend3", "friend4"];

  const users = await Promise.all(
    usernames.map((username) =>
      prisma.user.upsert({
        where: { username },
        update: {},
        create: { username },
      }),
    ),
  );

  await Promise.all(
    users.map((user: User, i: number) =>
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: user.id } },
        update: {},
        create: {
          groupId: group.id,
          userId: user.id,
          role: i === 0 ? "ADMIN" : "MEMBER",
        },
      }),
    ),
  );

  console.log(`Seeded group "${group.name}" with ${users.length} members.`);

  // Sample parlays are only created once -- re-running this script after the first
  // time just leaves them alone, so it's safe to reseed for user/group changes.
  const existingParlayCount = await prisma.parlay.count({ where: { groupId: group.id } });
  if (existingParlayCount > 0) {
    console.log(`Group already has ${existingParlayCount} parlay(s), skipping sample parlays.`);
    return;
  }

  const [alice, bob, carol, dave] = users;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const at = (hour: number, minute = 0) => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  // 1pm NFL slot -- OPEN, nobody has picked yet.
  await createSampleParlay({
    groupId: group.id,
    creatorId: alice.id,
    league: "NFL",
    label: "1 o'clock games",
    startsAt: at(13),
    endsAt: at(16),
    legs: [],
  });

  // 4pm NFL slot -- OPEN, partially picked (2 of 4): one team bet, one player prop.
  await createSampleParlay({
    groupId: group.id,
    creatorId: bob.id,
    league: "NFL",
    label: "4 o'clock games",
    startsAt: at(16, 5),
    endsAt: at(19),
    legs: [
      {
        userId: alice.id,
        homeTeam: "49ers",
        awayTeam: "Rams",
        market: Market.SPREAD,
        side: Side.HOME,
        lineAtPick: -6.5,
        priceAtPick: -110,
      },
      {
        userId: bob.id,
        homeTeam: "Chiefs",
        awayTeam: "Broncos",
        market: Market.PLAYER_PROP,
        side: Side.OVER,
        lineAtPick: 275.5,
        priceAtPick: -115,
        playerName: "Patrick Mahomes",
        propType: "Passing Yards",
      },
    ],
  });

  // Sunday Night Football -- LOCKED with 3 of 4 legs (the plan explicitly calls out a
  // locked-with-3-legs case, since a parlay can lock with 2-4 legs, not just 4). All
  // three legs happen to share the same matchup, which is now perfectly fine.
  await createSampleParlay({
    groupId: group.id,
    creatorId: carol.id,
    league: "NFL",
    label: "SNF",
    startsAt: at(20, 20),
    endsAt: at(23, 30),
    status: ParlayStatus.LOCKED,
    lockedAt: new Date(),
    legs: [
      {
        userId: alice.id,
        homeTeam: "Bengals",
        awayTeam: "Dolphins",
        market: Market.SPREAD,
        side: Side.HOME,
        lineAtPick: -3,
        priceAtPick: -110,
      },
      {
        userId: bob.id,
        homeTeam: "Bengals",
        awayTeam: "Dolphins",
        market: Market.TOTAL,
        side: Side.UNDER,
        lineAtPick: 47.5,
        priceAtPick: -110,
      },
      {
        userId: carol.id,
        homeTeam: "Bengals",
        awayTeam: "Dolphins",
        market: Market.MONEYLINE,
        side: Side.AWAY,
        lineAtPick: null,
        priceAtPick: 145,
      },
    ],
  });

  // An NBA slot, to show this isn't NFL-only.
  await createSampleParlay({
    groupId: group.id,
    creatorId: dave.id,
    league: "NBA",
    label: null,
    startsAt: at(19, 30),
    endsAt: at(22, 30),
    legs: [],
  });

  // A "just for fun" parlay that shouldn't count toward the leaderboard -- resolved with
  // everyone winning, to prove the leaderboard query actually excludes it.
  await createSampleParlay({
    groupId: group.id,
    creatorId: alice.id,
    league: "NFL",
    label: "Just for laughs",
    startsAt: at(13),
    endsAt: at(16),
    countsForRecord: false,
    status: ParlayStatus.RESOLVED,
    lockedAt: new Date(),
    resolvedAt: new Date(),
    result: LegResult.WIN,
    legs: [
      {
        userId: alice.id,
        homeTeam: "Packers",
        awayTeam: "Bears",
        market: Market.SPREAD,
        side: Side.HOME,
        lineAtPick: -2.5,
        priceAtPick: -110,
        result: LegResult.WIN,
        badge: Badge.MONEYBAG,
      },
      {
        userId: bob.id,
        homeTeam: "Vikings",
        awayTeam: "Lions",
        market: Market.SPREAD,
        side: Side.AWAY,
        lineAtPick: 3.5,
        priceAtPick: -110,
        result: LegResult.WIN,
        badge: Badge.MONEYBAG,
      },
    ],
  });

  // A real, resolved parlay: 3 wins + 1 loss, so the lone loser gets TOILET instead of
  // a plain POO -- exercises computeBadges end to end and gives the leaderboard data.
  await createSampleParlay({
    groupId: group.id,
    creatorId: bob.id,
    league: "NFL",
    label: "1 o'clock games",
    startsAt: new Date(at(13).getTime() - 7 * 24 * 60 * 60 * 1000),
    endsAt: new Date(at(16).getTime() - 7 * 24 * 60 * 60 * 1000),
    status: ParlayStatus.RESOLVED,
    lockedAt: new Date(),
    resolvedAt: new Date(),
    result: LegResult.LOSS,
    legs: [
      {
        userId: alice.id,
        homeTeam: "Texans",
        awayTeam: "Colts",
        market: Market.SPREAD,
        side: Side.HOME,
        lineAtPick: -1.5,
        priceAtPick: -110,
        result: LegResult.WIN,
        badge: Badge.MONEYBAG,
      },
      {
        userId: bob.id,
        homeTeam: "Titans",
        awayTeam: "Jaguars",
        market: Market.TOTAL,
        side: Side.OVER,
        lineAtPick: 42.5,
        priceAtPick: -105,
        result: LegResult.WIN,
        badge: Badge.MONEYBAG,
      },
      {
        userId: carol.id,
        homeTeam: "Saints",
        awayTeam: "Falcons",
        market: Market.MONEYLINE,
        side: Side.HOME,
        lineAtPick: null,
        priceAtPick: -130,
        result: LegResult.WIN,
        badge: Badge.MONEYBAG,
      },
      {
        userId: dave.id,
        homeTeam: "Texans",
        awayTeam: "Colts",
        market: Market.SPREAD,
        side: Side.AWAY,
        lineAtPick: 1.5,
        priceAtPick: -110,
        result: LegResult.LOSS,
        badge: Badge.TOILET,
      },
    ],
  });

  console.log("Seeded sample parlays.");
}

type SampleLeg = {
  userId: string;
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  lineAtPick: number | null;
  priceAtPick: number;
  playerName?: string;
  propType?: string;
  result?: LegResult;
  badge?: Badge;
};

async function createSampleParlay(input: {
  groupId: string;
  creatorId: string;
  league: string;
  label: string | null;
  startsAt: Date;
  endsAt: Date;
  stake?: number;
  legs: SampleLeg[];
  status?: ParlayStatus;
  countsForRecord?: boolean;
  lockedAt?: Date;
  resolvedAt?: Date;
  result?: LegResult;
}) {
  const window = await prisma.window.create({
    data: {
      league: input.league,
      label: input.label,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    },
  });

  const parlay = await prisma.parlay.create({
    data: {
      groupId: input.groupId,
      windowId: window.id,
      creatorId: input.creatorId,
      status: input.status ?? ParlayStatus.OPEN,
      countsForRecord: input.countsForRecord ?? true,
      stake: input.stake ?? 10,
      lockedAt: input.lockedAt,
      resolvedAt: input.resolvedAt,
      result: input.result ?? LegResult.PENDING,
    },
  });

  // Games aren't pre-listed anymore -- each leg names its own matchup. Dedupe by
  // (unordered) team pair within this parlay so legs sharing a matchup (e.g. a
  // single-game slot) share one Game row, same as the real pickLeg action does.
  const gameCache = new Map<string, string>();
  for (const leg of input.legs) {
    const key = [leg.homeTeam.toLowerCase(), leg.awayTeam.toLowerCase()].sort().join("|");
    let gameId = gameCache.get(key);
    if (!gameId) {
      const game = await prisma.game.create({
        data: {
          windowId: window.id,
          homeTeam: leg.homeTeam,
          awayTeam: leg.awayTeam,
          commenceTime: input.startsAt,
        },
      });
      gameId = game.id;
      gameCache.set(key, gameId);
    }

    await prisma.leg.create({
      data: {
        parlayId: parlay.id,
        userId: leg.userId,
        gameId,
        market: leg.market,
        side: leg.side,
        lineAtPick: leg.lineAtPick,
        priceAtPick: leg.priceAtPick,
        playerName: leg.playerName ?? null,
        propType: leg.propType ?? null,
        result: leg.result ?? LegResult.PENDING,
        badge: leg.badge ?? Badge.NONE,
      },
    });
  }

  return parlay;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
