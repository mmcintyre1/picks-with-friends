import { notFound } from "next/navigation";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { BADGE_EMOJI } from "@/lib/badges";
import { formatGameTime } from "@/lib/formatGameTime";
import {
  computeProfit,
  decimalToAmerican,
  effectiveCombinedOdds,
  formatAmericanOdds,
} from "@/lib/grading/parlayStats";
import { legSummary } from "@/lib/legSummary";
import { toSportKeys } from "@/lib/odds/leagueMap";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { GradeForm } from "./GradeForm";
import { LegRow } from "./LegRow";
import { OddsOverrideEditor } from "./OddsOverrideEditor";
import { PickFlow } from "./PickFlow";
import { ResolvedGradeEditor } from "./ResolvedGradeEditor";

function parlayStatusPill(status: ParlayStatus, result: LegResult) {
  if (status === ParlayStatus.OPEN) return <StatusPill tone="accent">Open</StatusPill>;
  if (status === ParlayStatus.LOCKED) return <StatusPill tone="pending">Awaiting grading</StatusPill>;
  if (status === ParlayStatus.RESOLVED) {
    return result === LegResult.WIN ? (
      <StatusPill tone="win">Won</StatusPill>
    ) : (
      <StatusPill tone="loss">Lost</StatusPill>
    );
  }
  return <StatusPill tone="muted">{status}</StatusPill>;
}

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

  const combinedOdds = effectiveCombinedOdds(
    parlay.legs.map((leg) => ({ priceAtPick: leg.priceAtPick, result: leg.result })),
    parlay.oddsOverride,
  );
  const profit = combinedOdds !== null ? computeProfit(parlay.stake, combinedOdds) : null;
  const gameIds = parlay.legs.map((leg) => leg.gameId);
  const hasSameGameLegs = new Set(gameIds).size !== gameIds.length;
  const liveOddsAvailable = Boolean(toSportKeys(parlay.window.league));

  const memberRows = members.map((member) => {
    const leg = parlay.legs.find((l) => l.userId === member.userId);
    return {
      userId: member.userId,
      name: member.user.name ?? member.user.username,
      flair: member.user.flair,
      isMe: member.userId === user.id,
      hasLeg: Boolean(leg),
      summary: leg ? legSummary(leg, leg.game) : undefined,
      odds: leg?.priceAtPick != null ? formatAmericanOdds(leg.priceAtPick) : null,
      date: leg ? formatGameTime(leg.game.commenceTime.toISOString()) : undefined,
    };
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{parlay.window.league}</p>
        <h1 className="font-display text-2xl tracking-wide">{parlay.window.label ?? parlay.window.league}</h1>
        <p className="text-xs text-subtle">Created {parlay.createdAt.toLocaleString()}</p>
        {!parlay.countsForRecord && (
          <p className="mt-1 text-xs text-push">Just for fun — doesn&apos;t count toward the record</p>
        )}
        <div className="mt-2">{parlayStatusPill(parlay.status, parlay.result)}</div>
      </div>

      {parlay.legs.length > 0 && (
        <Card className="flex flex-col gap-2 p-3 text-sm">
          {combinedOdds === null ? (
            <p className="text-muted">Combined odds: N/A (a pick is missing a price)</p>
          ) : (
            <p>
              Combined odds:{" "}
              <span className="font-display tracking-wide text-accent tabular-nums">
                {formatAmericanOdds(decimalToAmerican(combinedOdds))}
              </span>
              {parlay.oddsOverride != null && <span className="text-pending"> (manual)</span>}
              {" · "}Stake: <span className="font-display tabular-nums">${parlay.stake.toFixed(2)}</span>
              {" · "}
              {parlay.status === ParlayStatus.RESOLVED ? (
                parlay.result === LegResult.WIN ? (
                  <>
                    Won: <span className="font-display tracking-wide text-win tabular-nums">+${profit!.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    Lost:{" "}
                    <span className="font-display tracking-wide text-loss tabular-nums">
                      -${parlay.stake.toFixed(2)}
                    </span>
                  </>
                )
              ) : (
                <>
                  To win: <span className="font-display tracking-wide tabular-nums">${profit!.toFixed(2)}</span>
                </>
              )}
            </p>
          )}
          <OddsOverrideEditor
            parlayId={parlay.id}
            oddsOverride={parlay.oddsOverride}
            hasSameGameLegs={hasSameGameLegs}
          />
        </Card>
      )}

      {parlay.status === ParlayStatus.OPEN && (
        <PickFlow
          parlayId={parlay.id}
          memberRows={memberRows}
          myLegInitial={
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
          liveOddsAvailable={liveOddsAvailable}
          league={parlay.window.league}
          isCreator={parlay.creatorId === user.id}
        />
      )}

      {parlay.status !== ParlayStatus.OPEN && (
        <div className="flex flex-col gap-3">
          {memberRows.map((m) => {
            const leg = parlay.legs.find((l) => l.userId === m.userId);
            return (
              <LegRow
                key={m.userId}
                name={m.name}
                flair={m.flair}
                noPick={!m.hasLeg}
                summary={m.summary}
                odds={m.odds}
                date={m.date}
                resultEmoji={
                  parlay.status === ParlayStatus.RESOLVED && leg ? BADGE_EMOJI[leg.badge] : undefined
                }
              />
            );
          })}
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
          <p className={`text-lg font-semibold ${parlay.result === LegResult.WIN ? "text-win" : "text-loss"}`}>
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
