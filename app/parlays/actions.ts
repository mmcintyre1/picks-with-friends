"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";
import { computeBadges } from "@/lib/grading/computeBadges";
import { getBoxScoreProvider } from "@/lib/evaluate";
import { resolveLeg } from "@/lib/evaluate/resolveLeg";
import type { BoxScore } from "@/lib/evaluate/types";
import { LEAGUE_ESPN_PATHS } from "@/lib/rosters/leagues";
import { matchEspnEvent } from "@/lib/schedule/matchEspnEvent";
import { LegResult, Market, ParlayStatus, Side, TeamSide } from "@/app/generated/prisma/enums";

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
  // Only meaningful when market is TEAM_TOTAL -- which team the total belongs to.
  teamSide: TeamSide | null;
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
    teamSide: input.market === Market.TEAM_TOTAL ? input.teamSide : null,
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

// Reverts a mis-timed lock back to OPEN so picks can be added or changed again --
// LOCKED only, not RESOLVED (undoing an actual evaluation is a different, bigger action
// than this). Same open-to-any-member posture as lockParlay itself.
export async function unlockParlay(parlayId: string): Promise<ActionResult> {
  const { group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay || parlay.groupId !== group.id) return { error: "Couldn't find that parlay." };
  if (parlay.status !== ParlayStatus.LOCKED) return { error: "This one's not locked." };

  await prisma.parlay.update({
    where: { id: parlayId },
    data: { status: ParlayStatus.OPEN, lockedAt: null, lockedById: null },
  });

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
}

// Open to any group member, any status -- lets a parlay's leaderboard participation be
// corrected after the fact (e.g. it was created as a real one but should've been "just
// for fun", or vice versa), not just fixed at creation time.
export async function setCountsForRecord(parlayId: string, countsForRecord: boolean): Promise<ActionResult> {
  const { group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay || parlay.groupId !== group.id) return { error: "Couldn't find that parlay." };

  await prisma.parlay.update({ where: { id: parlayId }, data: { countsForRecord } });

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/leaderboard");
}

// The label lives on Window, not Parlay -- open to any group member, any status, same as
// the rest of this app's controls. Purely a display tag, so there's nothing to validate
// beyond trimming; an empty value clears back to showing the league name instead.
export async function setWindowLabel(parlayId: string, label: string): Promise<ActionResult> {
  const { group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay || parlay.groupId !== group.id) return { error: "Couldn't find that parlay." };

  await prisma.window.update({ where: { id: parlay.windowId }, data: { label: label.trim() || null } });

  revalidatePath(`/parlays/${parlayId}`);
  revalidatePath("/");
}

// Open to any group member, any status (open/locked/resolved) -- consequential (destroys
// the parlay and everyone's picks permanently), so the UI gates this behind a confirm
// modal rather than any server-side role check, matching every other action in this app.
// Deleting the Window cascades: Window -> Parlay -> Legs, and Window -> Games ->
// OddsSnapshots (see schema.prisma's onDelete: Cascade chains). Windows are created
// fresh, 1:1 with their parlay (see createParlay above), so this cleans up everything
// the parlay owns in one delete instead of leaving orphaned Window/Game rows behind.
export async function deleteParlay(parlayId: string): Promise<ActionResult> {
  const { group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({ where: { id: parlayId } });
  if (!parlay || parlay.groupId !== group.id) return { error: "Couldn't find that parlay." };

  await prisma.window.delete({ where: { id: parlay.windowId } });

  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/admin");
}

// Bulk version of deleteParlay for a full board reset -- same cascade reasoning, just
// for every parlay in the group at once. Player accounts/PINs/flair are untouched.
export async function wipeAllParlays(): Promise<void> {
  const { group } = await requireUserAndGroup();

  const parlays = await prisma.parlay.findMany({ where: { groupId: group.id }, select: { windowId: true } });
  await prisma.window.deleteMany({ where: { id: { in: parlays.map((p) => p.windowId) } } });

  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/admin");
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

// Per-parlay spam guard for evaluateParlay -- checked before any ESPN fetch happens, since
// a parlay can span several distinct games and the box-score fetch cache (per-game) alone
// wouldn't stop a burst of clicks from fanning out across all of them.
const EVALUATE_COOLDOWN_MS = 20_000;
// Resolves and caches a Game's ESPN event id via lib/schedule/matchEspnEvent.ts's shared
// matcher, searched around *now* -- reasonable for a friend-group app that evaluates games
// around when they're happening or shortly after, not days later (lib/trends/ is the other
// real caller of that shared matcher, and searches around a game's own commenceTime
// instead, since research browsing can happen days before kickoff). Deliberately not
// reusing Game.externalId -- that field is ambiguous between two different providers' id
// namespaces (see schema.prisma's comment on it). Backfill-only-if-null, same discipline
// findOrCreateGame already uses for externalId/league.
async function resolveEspnEventId(game: {
  id: string;
  espnEventId: string | null;
  league: string | null;
  homeTeam: string;
  awayTeam: string;
}): Promise<string | null> {
  if (game.espnEventId) return game.espnEventId;

  const matched = await matchEspnEvent(game.league, game.homeTeam, game.awayTeam, new Date());
  if (!matched) return null;

  await prisma.game.update({ where: { id: game.id }, data: { espnEventId: matched } });
  return matched;
}

export type EvaluateOutcome = {
  // legId -> result, only for legs that got a definite result THIS call (already-resolved
  // legs from a prior partial evaluate aren't repeated here).
  results: Record<string, LegResult>;
  // legId -> a short human status for every leg that's still not resolved after this call
  // (live game state, "can't auto-check this one", etc.) -- this is how "signal status"
  // surfaces in the UI.
  statuses: Record<string, string>;
  // Whether the parlay is fully resolved after this call (either just now, or already was).
  resolved: boolean;
};
export type EvaluateParlayResult = { error: string } | EvaluateOutcome;

// Auto-grades whatever legs of a LOCKED parlay can be determined from real ESPN box
// scores, leaving the rest PENDING for manual grading (GradeForm/ResolvedGradeEditor are
// completely untouched -- this only ever supplies pre-filled initialResults, never
// replaces the manual path). See lib/evaluate/resolveLeg.ts for exactly what can resolve
// early (TOTAL/PLAYER_PROP over-side and PLAYER_PROP_YESNO yes-side clinch the instant a
// counting stat crosses its line; everything else waits for the game to go FINAL).
export async function evaluateParlay(parlayId: string): Promise<EvaluateParlayResult> {
  const { group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    include: { legs: { include: { game: true } } },
  });
  if (!parlay || parlay.groupId !== group.id) return { error: "Couldn't find that parlay." };
  if (parlay.status !== ParlayStatus.LOCKED && parlay.status !== ParlayStatus.RESOLVED) {
    return { error: "Can't evaluate — nothing's locked yet." };
  }

  if (parlay.lastEvaluatedAt && Date.now() - parlay.lastEvaluatedAt.getTime() < EVALUATE_COOLDOWN_MS) {
    return { error: "Just checked — give it a bit before trying again." };
  }
  await prisma.parlay.update({ where: { id: parlayId }, data: { lastEvaluatedAt: new Date() } });

  const pendingLegs = parlay.legs.filter((leg) => leg.result === LegResult.PENDING);
  const results: Record<string, LegResult> = {};
  const statuses: Record<string, string> = {};
  const boxScoreByGame = new Map<string, BoxScore>();

  for (const leg of pendingLegs) {
    const league = leg.game.league;
    if (!league || !(league in LEAGUE_ESPN_PATHS)) {
      statuses[leg.id] = "Can't auto-check this one — unrecognized matchup. Grade it manually.";
      continue;
    }

    let box = boxScoreByGame.get(leg.gameId);
    if (!box) {
      const espnEventId = await resolveEspnEventId(leg.game);
      if (!espnEventId) {
        statuses[leg.id] = "Can't find this game on ESPN yet — grade it manually.";
        continue;
      }
      try {
        box = await getBoxScoreProvider().getBoxScore(LEAGUE_ESPN_PATHS[league], espnEventId);
      } catch {
        statuses[leg.id] = "ESPN lookup failed — try again shortly, or grade it manually.";
        continue;
      }
      boxScoreByGame.set(leg.gameId, box);
    }

    const resolved = resolveLeg(
      {
        market: leg.market,
        side: leg.side,
        teamSide: leg.teamSide,
        lineAtPick: leg.lineAtPick,
        playerName: leg.playerName,
        propType: leg.propType,
      },
      box,
      league,
    );
    if (resolved.result) {
      results[leg.id] = resolved.result;
    } else if (resolved.reason === "unmappable") {
      statuses[leg.id] = "Can't auto-check this pick — grade it manually.";
    } else {
      statuses[leg.id] = box.status.detail || "Not started yet";
    }
  }

  const stillPending = pendingLegs.filter((leg) => !(leg.id in results));

  // Every previously-PENDING leg now has a result -> fully resolve, same finalize shape
  // gradeParlay uses below, but gradedById stays unset -- the schema's own seam for
  // "resolved automatically, not by a person" (see Parlay.gradedById's comment).
  if (pendingLegs.length > 0 && stillPending.length === 0) {
    const legInputs = parlay.legs.map((leg) => ({ id: leg.id, result: results[leg.id] ?? leg.result }));
    const badges = computeBadges(legInputs);
    const overallResult = legInputs.every((leg) => leg.result !== LegResult.LOSS) ? LegResult.WIN : LegResult.LOSS;

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
    return { results, statuses, resolved: true };
  }

  // Partial: persist just the legs that got clinched this round (no badges yet -- those
  // need the whole parlay's picture, computed once at full resolution, same as today).
  // Leaves the parlay LOCKED so GradeForm/manual entry stays available for the rest.
  if (Object.keys(results).length > 0) {
    await prisma.$transaction(
      Object.entries(results).map(([legId, result]) =>
        prisma.leg.update({ where: { id: legId }, data: { result } }),
      ),
    );
    revalidatePath(`/parlays/${parlayId}`);
  }

  return { results, statuses, resolved: parlay.status === ParlayStatus.RESOLVED };
}
