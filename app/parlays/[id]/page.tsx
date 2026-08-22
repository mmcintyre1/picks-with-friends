import { notFound } from "next/navigation";

import { LegResult, ParlayStatus } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { BADGE_EMOJI } from "@/lib/badges";
import { formatDateTime, formatGameTime } from "@/lib/formatGameTime";
import {
  computeProfit,
  decimalToAmerican,
  effectiveCombinedOdds,
  formatAmericanOdds,
} from "@/lib/grading/parlayStats";
import { legSummary } from "@/lib/legSummary";
import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

import { AutoEvaluatePanel } from "./AutoEvaluatePanel";
import { CountsForRecordToggle } from "./CountsForRecordToggle";
import { DeleteParlayButton } from "./DeleteParlayButton";
import { LegRow } from "./LegRow";
import { LockButton } from "./LockButton";
import { NoPickSummary } from "./NoPickSummary";
import { OddsOverrideEditor } from "./OddsOverrideEditor";
import { PickFlow } from "./PickFlow";
import { ResolvedGradeEditor } from "./ResolvedGradeEditor";
import { ShareParlayButton } from "./ShareParlayButton";
import { UnlockButton } from "./UnlockButton";

function parlayStatusPill(status: ParlayStatus, result: LegResult) {
  if (status === ParlayStatus.OPEN) return <StatusPill tone="accent">Open</StatusPill>;
  if (status === ParlayStatus.LOCKED) return <StatusPill tone="pending">Awaiting evaluation</StatusPill>;
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
      lockedBy: true,
      gradedBy: true,
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        {parlay.window.label && (
          <p className="text-xs uppercase tracking-wide text-muted">{parlay.window.league}</p>
        )}
        <h1 className="font-display text-2xl tracking-wide">{parlay.window.label ?? parlay.window.league}</h1>
        <p className="text-xs text-subtle">Created {formatDateTime(parlay.createdAt)}</p>
        <div className="mt-2 flex items-center justify-between">
          {/* Left: the parlay's own lifecycle controls, grouped with the status pill they
              affect -- record and lock/unlock are "manage this parlay's state" actions. */}
          <div className="flex items-center gap-1">
            {parlayStatusPill(parlay.status, parlay.result)}
            <CountsForRecordToggle parlayId={parlay.id} countsForRecord={parlay.countsForRecord} />
            {parlay.status === ParlayStatus.OPEN && parlay.legs.length >= 2 && <LockButton parlayId={parlay.id} />}
            {parlay.status === ParlayStatus.LOCKED && <UnlockButton parlayId={parlay.id} />}
          </div>
          {/* Right: Share (a completely different workflow -- distribution, not state) and
              Delete (destructive) get real separation from each other and from the cluster
              above, so a mobile misclick reaching for one can't land on the other. */}
          <div className="-mr-2 flex items-center gap-3">
            <ShareParlayButton parlayId={parlay.id} title={parlay.window.label ?? parlay.window.league} />
            <div aria-hidden className="h-5 w-px bg-border" />
            <DeleteParlayButton parlayId={parlay.id} />
          </div>
        </div>
        {(parlay.lockedBy || parlay.gradedBy || parlay.status === ParlayStatus.RESOLVED) && (
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-subtle">
            {parlay.lockedBy && (
              <span>
                Locked by{" "}
                <PlayerName name={parlay.lockedBy.name ?? parlay.lockedBy.username} flair={parlay.lockedBy.flair} />
              </span>
            )}
            {parlay.status === ParlayStatus.RESOLVED &&
              (parlay.gradedBy ? (
                <span>
                  Evaluated by{" "}
                  <PlayerName name={parlay.gradedBy.name ?? parlay.gradedBy.username} flair={parlay.gradedBy.flair} />
                </span>
              ) : (
                <span>Auto-evaluated</span>
              ))}
          </p>
        )}
      </div>

      {parlay.legs.length > 0 && (
        <Card className="flex flex-col gap-2 p-3 text-sm">
          {combinedOdds === null ? (
            <p className="text-muted">Combined odds: can&apos;t call it — someone&apos;s missing a price.</p>
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
                  league: myLeg.game.league,
                  market: myLeg.market,
                  side: myLeg.side,
                  line: myLeg.lineAtPick,
                  price: myLeg.priceAtPick,
                  playerName: myLeg.playerName,
                  propType: myLeg.propType,
                }
              : undefined
          }
          defaultLeague={parlay.window.league}
        />
      )}

      {parlay.status !== ParlayStatus.OPEN && (
        <div className="flex flex-col gap-3">
          {memberRows
            .filter((m) => m.hasLeg)
            .map((m) => {
              const leg = parlay.legs.find((l) => l.userId === m.userId);
              return (
                <LegRow
                  key={m.userId}
                  name={m.name}
                  flair={m.flair}
                  summary={m.summary}
                  odds={m.odds}
                  date={m.date}
                  resultEmoji={
                    parlay.status === ParlayStatus.RESOLVED && leg ? BADGE_EMOJI[leg.badge] : undefined
                  }
                  result={parlay.status === ParlayStatus.RESOLVED ? leg?.result : undefined}
                />
              );
            })}
          <NoPickSummary label="Sat out:" members={memberRows.filter((m) => !m.hasLeg)} />
        </div>
      )}

      {parlay.status === ParlayStatus.LOCKED && (
        <AutoEvaluatePanel
          parlayId={parlay.id}
          legs={parlay.legs.map((leg) => ({
            id: leg.id,
            userName: leg.user.name ?? leg.user.username,
            summary: legSummary(leg, leg.game),
          }))}
          lastEvaluatedAt={parlay.lastEvaluatedAt}
        />
      )}

      {parlay.status === ParlayStatus.RESOLVED && (
        <div className="flex flex-col gap-2">
          {/* No separate "Parlay hit!/busted" banner here anymore -- it was just restating
              what the status pill up top and the now-color-coded leg rows above already
              make obvious, adding nothing new. */}
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
