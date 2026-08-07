"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";
import { canPickGame } from "@/lib/validation/legConstraints";
import { computeBadges } from "@/lib/grading/computeBadges";
import { LegResult, Market, ParlayStatus, Side } from "@/app/generated/prisma/enums";

export type ActionResult = { error: string } | undefined;

export type CreateParlayInput = {
  league: string;
  label: string;
  singleGame: boolean;
  countsForRecord: boolean;
};

export async function createParlay(input: CreateParlayInput): Promise<ActionResult> {
  const { user, group } = await requireUserAndGroup();

  if (!input.league.trim()) return { error: "League is required." };

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
      singleGame: input.singleGame,
    },
  });

  const parlay = await prisma.parlay.create({
    data: {
      groupId: group.id,
      windowId: window.id,
      creatorId: user.id,
      countsForRecord: input.countsForRecord,
    },
  });

  redirect(`/parlays/${parlay.id}`);
}

export type PickLegInput = {
  homeTeam: string;
  awayTeam: string;
  market: Market;
  side: Side;
  line: string;
  price: string;
  playerName: string;
  propType: string;
};

const PROP_MARKETS = new Set<Market>([Market.PLAYER_PROP, Market.PLAYER_PROP_YESNO]);

// Games aren't pre-listed by the creator -- each pick just names its matchup. Reuse an
// existing Game row for the same two teams (case-insensitive, order-independent) so
// repeated picks on one matchup share a single record instead of duplicating it.
async function findOrCreateGame(windowId: string, homeTeamRaw: string, awayTeamRaw: string) {
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
  if (existing) return existing;

  return prisma.game.create({ data: { windowId, homeTeam, awayTeam, commenceTime: new Date() } });
}

export async function pickLeg(parlayId: string, input: PickLegInput): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  if (!input.homeTeam.trim() || !input.awayTeam.trim()) {
    return { error: "Enter both teams for this game." };
  }

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    include: { legs: true, window: true },
  });
  if (!parlay) return { error: "Parlay not found." };
  if (parlay.status !== ParlayStatus.OPEN) {
    return { error: "This parlay is no longer open for picks." };
  }

  const isProp = PROP_MARKETS.has(input.market);
  const playerName = isProp ? input.playerName.trim() : null;
  const propType = isProp ? input.propType.trim() : null;
  if (isProp && (!playerName || !propType)) {
    return { error: "Player props need a player name and a stat type." };
  }

  const line = input.line.trim() ? Number(input.line) : null;
  const price = input.price.trim() ? Number(input.price) : null;
  if (line !== null && Number.isNaN(line)) return { error: "Line must be a number." };
  if (price !== null && Number.isNaN(price)) return { error: "Price must be a number." };
  if (input.market === Market.PLAYER_PROP && line === null) {
    return { error: "Over/under props need a line." };
  }

  const game = await findOrCreateGame(parlay.windowId, input.homeTeam, input.awayTeam);

  // A game is "used" once someone picks it, regardless of whether their pick was a
  // team market or a player prop -- one rule for everyone, not two.
  const otherLegs = parlay.legs.filter((leg) => leg.userId !== user.id);
  const check = canPickGame(game.id, parlay.window.singleGame, otherLegs);
  if (!check.ok) return { error: check.reason };

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
}

export async function cancelLeg(parlayId: string): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay) return { error: "Parlay not found." };
  if (parlay.status !== ParlayStatus.OPEN) {
    return { error: "Can't cancel a pick once the parlay is locked." };
  }

  await prisma.leg.deleteMany({ where: { parlayId, userId: user.id } });
  revalidatePath(`/parlays/${parlayId}`);
}

export async function lockParlay(parlayId: string): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId }, include: { legs: true } });
  if (!parlay) return { error: "Parlay not found." };
  if (parlay.creatorId !== user.id) return { error: "Only the creator can lock this parlay." };
  if (parlay.status !== ParlayStatus.OPEN) return { error: "This parlay isn't open." };
  if (parlay.legs.length < 2 || parlay.legs.length > 4) {
    return { error: "Need 2-4 picks in before this can lock." };
  }

  await prisma.parlay.update({
    where: { id: parlayId },
    data: { status: ParlayStatus.LOCKED, lockedAt: new Date() },
  });

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
}

export async function gradeParlay(
  parlayId: string,
  results: Record<string, LegResult>,
): Promise<ActionResult> {
  const { user } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId }, include: { legs: true } });
  if (!parlay) return { error: "Parlay not found." };
  if (parlay.creatorId !== user.id) return { error: "Only the creator can grade this parlay." };
  if (parlay.status !== ParlayStatus.LOCKED) return { error: "This parlay isn't locked yet." };

  const legInputs = parlay.legs.map((leg) => ({ id: leg.id, result: results[leg.id] }));
  if (legInputs.some((leg) => !leg.result)) return { error: "Grade every leg before resolving." };

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
      data: { status: ParlayStatus.RESOLVED, resolvedAt: new Date(), result: overallResult },
    }),
  ]);

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/");
}
