"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";
import { computeBadges } from "@/lib/grading/computeBadges";
import { LegResult, Market, ParlayStatus, Side } from "@/app/generated/prisma/enums";

export type ActionResult = { error: string } | undefined;

export type CreateParlayInput = {
  league: string;
  label: string;
  countsForRecord: boolean;
  stake: string;
};

export async function createParlay(input: CreateParlayInput): Promise<ActionResult> {
  const { user, group } = await requireUserAndGroup();

  if (!input.league.trim()) return { error: "Needs a league." };
  const stake = Number(input.stake);
  if (!input.stake.trim() || Number.isNaN(stake) || stake <= 0) {
    return { error: "Needs a stake above zero." };
  }

  // Kickoff time isn't tracked -- what matters is the slot (label), not a precise
  // boundary. startsAt/endsAt still exist on the schema for any future odds-sync
  // querying, just stamped with "now" instead of asked for in the UI. Games also
  // aren't pre-listed here anymore -- each pick names its own matchup.
  const now = new Date();

  const window = await prisma.window.create({
    data: {
      league: input.league.trim(),
      label: input.label.trim() || null,
      startsAt: now,
      endsAt: now,
    },
  });

  const parlay = await prisma.parlay.create({
    data: {
      groupId: group.id,
      windowId: window.id,
      creatorId: user.id,
      countsForRecord: input.countsForRecord,
      stake,
    },
  });

  redirect(`/parlays/${parlay.id}`);
}

export type PickLegInput = {
  homeTeam: string;
  awayTeam: string;
  // The sport this specific pick is for, chosen per pick in PickLegForm's Sport selector --
  // independent of the parlay's Window.league label, since different members can pick
  // different sports within the same parlay regardless of what the parlay is tagged.
  league: string;
  market: Market;
  side: Side;
  line: string;
  price: string;
  playerName: string;
  propType: string;
  externalId: string;
};

const PROP_MARKETS = new Set<Market>([Market.PLAYER_PROP, Market.PLAYER_PROP_YESNO]);

// Games aren't pre-listed by the creator -- each pick just names its matchup. Reuse an
// existing Game row for the same two teams (case-insensitive, order-independent) so
// repeated picks on one matchup share a single record instead of duplicating it.
// `externalId` (the live-odds/schedule provider's event id) and `league` are set on
// create, or backfilled onto an existing row that doesn't have one yet -- never
// overwritten once set, same discipline for both fields.
async function findOrCreateGame(
  windowId: string,
  homeTeamRaw: string,
  awayTeamRaw: string,
  externalId: string | null,
  league: string | null,
) {
  const homeTeam = homeTeamRaw.trim();
  const awayTeam = awayTeamRaw.trim();

  const existing = await prisma.game.findFirst({
    where: {
      windowId,
      OR: [
        { homeTeam: { equals: homeTeam, mode: "insensitive" }, awayTeam: { equals: awayTeam, mode: "insensitive" } },
        { homeTeam: { equals: awayTeam, mode: "insensitive" }, awayTeam: { equals: homeTeam, mode: "insensitive" } },
      ],
    },
  });
  if (existing) {
    const backfill: { externalId?: string; league?: string } = {};
    if (externalId && !existing.externalId) backfill.externalId = externalId;
    if (league && !existing.league) backfill.league = league;
    if (Object.keys(backfill).length > 0) {
      return prisma.game.update({ where: { id: existing.id }, data: backfill });
    }
    return existing;
  }

  return prisma.game.create({
    data: { windowId, homeTeam, awayTeam, commenceTime: new Date(), externalId, league },
  });
}

export async function pickLeg(parlayId: string, input: PickLegInput): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  if (!input.homeTeam.trim() || !input.awayTeam.trim()) {
    return { error: "This game needs both teams, not just one." };
  }

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    include: { legs: true },
  });
  if (!parlay) return { error: "Couldn't find that parlay." };
  if (parlay.status !== ParlayStatus.OPEN) {
    return { error: "Picks are closed on this one." };
  }

  const isProp = PROP_MARKETS.has(input.market);
  const playerName = isProp ? input.playerName.trim() : null;
  const propType = isProp ? input.propType.trim() : null;
  if (isProp && (!playerName || !propType)) {
    return { error: "Props need a player and a stat -- pick both." };
  }

  const line = input.line.trim() ? Number(input.line) : null;
  if (line !== null && Number.isNaN(line)) return { error: "That line's not a number." };
  if (input.market === Market.PLAYER_PROP && line === null) {
    return { error: "Over/under needs a line." };
  }

  // Odds are required (not just optional context) since they're what lets the parlay's
  // combined odds/payout be computed -- a leg with no odds would make that unknowable.
  const price = Number(input.price);
  if (!input.price.trim() || Number.isNaN(price)) {
    return { error: "Needs odds (e.g. -110)." };
  }

  const game = await findOrCreateGame(
    parlay.windowId,
    input.homeTeam,
    input.awayTeam,
    input.externalId.trim() || null,
    input.league.trim() || null,
  );

  const data = {
    gameId: game.id,
    market: input.market,
    side: input.side,
    lineAtPick: input.market === Market.PLAYER_PROP_YESNO ? null : line,
    priceAtPick: price,
    playerName,
    propType,
  };

  await prisma.leg.upsert({
    where: { parlayId_userId: { parlayId, userId: user.id } },
    update: data,
    create: { parlayId, userId: user.id, ...data },
  });

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
}

export async function cancelLeg(parlayId: string): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay) return { error: "Couldn't find that parlay." };
  if (parlay.status !== ParlayStatus.OPEN) {
    return { error: "Can't back out now — it's locked." };
  }

  await prisma.leg.deleteMany({ where: { parlayId, userId: user.id } });
  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
}

// Open to any group member, any parlay status -- correlated same-game legs price
// differently than the naive product computeCombinedOdds assumes, and there's no way to
// derive the real correlated number ourselves, so this lets someone plug in what a real
// sportsbook actually shows for that combination. Empty input clears the override.
export async function setOddsOverride(parlayId: string, value: string): Promise<ActionResult> {
  await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay) return { error: "Couldn't find that parlay." };

  const trimmed = value.trim();
  if (!trimmed) {
    await prisma.parlay.update({ where: { id: parlayId }, data: { oddsOverride: null } });
    revalidatePath(`/parlays/${parlayId}`);
    return;
  }

  const odds = Number(trimmed);
  if (!Number.isInteger(odds) || odds === 0) {
    return { error: "Needs real American odds, e.g. -150 or +220." };
  }

  await prisma.parlay.update({ where: { id: parlayId }, data: { oddsOverride: odds } });
  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
  revalidatePath("/leaderboard");
}

// Open to any group member, not just the creator -- same reasoning as gradeParlay below:
// nothing adversarial about this group, no reason to make one person a bottleneck. Who
// actually locked it is still recorded (lockedById), just as attribution, not a gate.
export async function lockParlay(parlayId: string): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId }, include: { legs: true } });
  if (!parlay) return { error: "Couldn't find that parlay." };
  if (parlay.status !== ParlayStatus.OPEN) return { error: "This one's not open." };
  if (parlay.legs.length < 2 || parlay.legs.length > 4) {
    return { error: "Needs 2 to 4 picks in before it can lock." };
  }

  await prisma.parlay.update({
    where: { id: parlayId },
    data: { status: ParlayStatus.LOCKED, lockedAt: new Date(), lockedById: user.id },
  });

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
}

export async function gradeParlay(
  parlayId: string,
  results: Record<string, LegResult>,
): Promise<ActionResult> {
  // Grading isn't a secret and there's no adversarial concern here -- any group member
  // can grade a locked parlay, and any group member can correct a resolved one later if
  // something was graded wrong. gradedById always reflects the most recent grader.
  const { user } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId }, include: { legs: true } });
  if (!parlay) return { error: "Couldn't find that parlay." };
  if (parlay.status !== ParlayStatus.LOCKED && parlay.status !== ParlayStatus.RESOLVED) {
    return { error: "Can't evaluate — nothing's locked yet." };
  }

  const legInputs = parlay.legs.map((leg) => ({ id: leg.id, result: results[leg.id] }));
  if (legInputs.some((leg) => !leg.result)) return { error: "Evaluate every leg before you're done." };

  const badges = computeBadges(legInputs);
  const overallResult = legInputs.every((leg) => leg.result !== LegResult.LOSS)
    ? LegResult.WIN
    : LegResult.LOSS;

  await prisma.$transaction([
    ...legInputs.map((leg) =>
      prisma.leg.update({ where: { id: leg.id }, data: { result: leg.result, badge: badges[leg.id] } }),
    ),
    prisma.parlay.update({
      where: { id: parlayId },
      data: { status: ParlayStatus.RESOLVED, resolvedAt: new Date(), result: overallResult, gradedById: user.id },
    }),
  ]);

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/");
}
