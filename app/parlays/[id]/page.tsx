import { notFound } from "next/navigation";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { BADGE_EMOJI, BADGE_LABEL } from "@/lib/badges";
import { legSummary } from "@/lib/legSummary";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { CancelLegButton } from "./CancelLegButton";
import { GradeForm } from "./GradeForm";
import { LockButton } from "./LockButton";
import { PickLegForm } from "./PickLegForm";

export default async function ParlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({
    where: { id },
    include: {
      window: true,
      legs: { include: { user: true, game: true } },
      creator: true,
    },
  });
  if (!parlay || parlay.groupId !== group.id) notFound();

  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true },
    orderBy: { user: { username: "asc" } },
  });

  const myLeg = parlay.legs.find((leg) => leg.userId === user.id);
  const otherUsedGames = parlay.legs
    .filter((leg) => leg.userId !== user.id)
    .map((leg) => ({ homeTeam: leg.game.homeTeam, awayTeam: leg.game.awayTeam }));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{parlay.window.league}</p>
        <h1 className="text-xl font-semibold">{parlay.window.label ?? parlay.window.league}</h1>
        <p className="text-xs text-gray-400">Created {parlay.createdAt.toLocaleString()}</p>
        {!parlay.countsForRecord && (
          <p className="mt-1 text-xs text-amber-500">Just for fun — doesn&apos;t count toward the record</p>
        )}
        <p className="mt-1 text-sm text-gray-500">Status: {parlay.status}</p>
      </div>

      <div className="flex flex-col gap-3">
        {members.map((member) => {
          const leg = parlay.legs.find((l) => l.userId === member.userId);
          const isMe = member.userId === user.id;
          return (
            <div
              key={member.userId}
              className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-gray-800"
            >
              <div>
                <p className="text-sm font-medium">{member.user.name ?? member.user.username}</p>
                {leg ? (
                  <p className="text-xs text-gray-500">
                    {legSummary(leg, leg.game)}
                    {parlay.status === ParlayStatus.RESOLVED && (
                      <>
                        {" — "}
                        {BADGE_EMOJI[leg.badge]} {BADGE_LABEL[leg.badge]} ({leg.result})
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">No pick yet</p>
                )}
              </div>
              {isMe && parlay.status === ParlayStatus.OPEN && leg && (
                <CancelLegButton parlayId={parlay.id} />
              )}
            </div>
          );
        })}
      </div>

      {parlay.status === ParlayStatus.OPEN && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">{myLeg ? "Change your pick" : "Make your pick"}</h2>
          <PickLegForm
            parlayId={parlay.id}
            singleGame={parlay.window.singleGame}
            usedGames={otherUsedGames}
            initial={
              myLeg
                ? {
                    homeTeam: myLeg.game.homeTeam,
                    awayTeam: myLeg.game.awayTeam,
                    market: myLeg.market,
                    side: myLeg.side,
                    line: myLeg.lineAtPick,
                    price: myLeg.priceAtPick,
                    playerName: myLeg.playerName,
                    propType: myLeg.propType,
                  }
                : undefined
            }
          />
          {parlay.creatorId === user.id && <LockButton parlayId={parlay.id} />}
        </div>
      )}

      {parlay.status === ParlayStatus.LOCKED && parlay.creatorId === user.id && (
        <GradeForm
          parlayId={parlay.id}
          legs={parlay.legs.map((leg) => ({
            id: leg.id,
            userName: leg.user.name ?? leg.user.username,
            summary: legSummary(leg, leg.game),
          }))}
        />
      )}
      {parlay.status === ParlayStatus.LOCKED && parlay.creatorId !== user.id && (
        <p className="text-sm text-gray-500">
          Locked — waiting for {parlay.creator.name ?? parlay.creator.username} to grade it once the
          games finish.
        </p>
      )}

      {parlay.status === ParlayStatus.RESOLVED && (
        <p className="text-lg font-semibold">
          {parlay.result === LegResult.WIN ? "Parlay hit! 🎉" : "Parlay busted."}
        </p>
      )}
    </main>
  );
}
