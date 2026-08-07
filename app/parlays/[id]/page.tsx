import { notFound } from "next/navigation";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { BADGE_EMOJI } from "@/lib/badges";
import {
  computeCombinedOdds,
  computeProfit,
  decimalToAmerican,
  formatAmericanOdds,
} from "@/lib/grading/parlayStats";
import { legSummary } from "@/lib/legSummary";
import { toSportKeys } from "@/lib/odds/leagueMap";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { CancelLegButton } from "./CancelLegButton";
import { GradeForm } from "./GradeForm";
import { LockButton } from "./LockButton";
import { PickLegForm } from "./PickLegForm";
import { ResolvedGradeEditor } from "./ResolvedGradeEditor";

export default async function ParlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, group } = await requireUserAndGroup();

  const parlay = await prisma.parlay.findUnique({
    where: { id },
    include: {
      window: true,
      legs: { include: { user: true, game: true } },
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

  const combinedOdds = computeCombinedOdds(
    parlay.legs.map((leg) => ({ priceAtPick: leg.priceAtPick, result: leg.result })),
  );
  const profit = combinedOdds !== null ? computeProfit(parlay.stake, combinedOdds) : null;
  const liveOddsAvailable = Boolean(toSportKeys(parlay.window.league));

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

      {parlay.legs.length > 0 && (
        <div className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-800">
          {combinedOdds === null ? (
            <p className="text-gray-400">Combined odds: N/A (a pick is missing a price)</p>
          ) : (
            <p>
              Combined odds: <span className="font-medium">{formatAmericanOdds(decimalToAmerican(combinedOdds))}</span>
              {" · "}Stake: ${parlay.stake.toFixed(2)}
              {" · "}
              {parlay.status === ParlayStatus.RESOLVED ? (
                parlay.result === LegResult.WIN ? (
                  <>
                    Won: <span className="font-medium text-green-600">+${profit!.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    Lost: <span className="font-medium text-red-500">-${parlay.stake.toFixed(2)}</span>
                  </>
                )
              ) : (
                <>
                  To win: <span className="font-medium">${profit!.toFixed(2)}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}

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
                    {parlay.status === ParlayStatus.RESOLVED && <> — {BADGE_EMOJI[leg.badge]}</>}
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
            liveOddsAvailable={liveOddsAvailable}
            league={parlay.window.league}
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

      {parlay.status === ParlayStatus.LOCKED && (
        <GradeForm
          parlayId={parlay.id}
          legs={parlay.legs.map((leg) => ({
            id: leg.id,
            userName: leg.user.name ?? leg.user.username,
            summary: legSummary(leg, leg.game),
          }))}
        />
      )}

      {parlay.status === ParlayStatus.RESOLVED && (
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold">
            {parlay.result === LegResult.WIN ? "Parlay hit! 🎉" : "Parlay busted."}
          </p>
          <ResolvedGradeEditor
            parlayId={parlay.id}
            legs={parlay.legs.map((leg) => ({
              id: leg.id,
              userName: leg.user.name ?? leg.user.username,
              summary: legSummary(leg, leg.game),
            }))}
            initialResults={Object.fromEntries(parlay.legs.map((leg) => [leg.id, leg.result]))}
          />
        </div>
      )}
    </main>
  );
}
