"use client";

import { useState, useTransition } from "react";

import { Market, Side, TeamSide } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SignedNumberInput } from "@/components/ui/SignedNumberInput";
import { legSummary } from "@/lib/legSummary";
import { PICKABLE_LEAGUES, teamLogoUrl } from "@/lib/rosters/leagues";
import type { PropPick, TeamBetPick } from "@/lib/research/types";

import { pickLeg } from "../actions";
import { CustomBetWizard } from "./CustomBetWizard";
import { ResearchBrowser } from "./ResearchBrowser";
import { TeamLabel } from "./TeamMarketGrid";

type Initial = {
  homeTeam: string;
  awayTeam: string;
  league: string | null;
  market: Market;
  side: Side;
  teamSide: TeamSide | null;
  line: number | null;
  price: number | null;
  playerName: string | null;
  propType: string | null;
};

type Sport = "NFL" | "NBA" | "MLB" | "NHL" | "other";

const SPORT_OPTIONS: { value: Sport; label: string }[] = [
  ...PICKABLE_LEAGUES.map((l) => ({ value: l as Sport, label: l })),
  { value: "other", label: "Other" },
];

const fieldListClass = "flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card";
const fieldRowClass = "flex items-stretch divide-x divide-border";
const groupFieldClass =
  "min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-foreground placeholder:text-subtle focus:bg-white/[0.03] focus:outline-none";

function initialSport(league: string | null | undefined): Sport {
  return league && (PICKABLE_LEAGUES as string[]).includes(league) ? (league as Sport) : "other";
}

// Describes the bet WITHOUT its line/odds -- those are the editable fields next to it in the
// inline editor, so showing a stale number in the label would contradict what's typed.
function betLabelWithoutLine(i: Initial): string {
  const overUnder = i.side === Side.OVER ? "Over" : "Under";
  if (i.market === Market.PLAYER_PROP) return `${i.playerName} (${i.propType}) ${overUnder}`;
  if (i.market === Market.PLAYER_PROP_YESNO) return `${i.playerName} (${i.propType}) — ${i.side === Side.YES ? "Yes" : "No"}`;
  const sideTeam = i.side === Side.HOME ? i.homeTeam : i.awayTeam;
  if (i.market === Market.MONEYLINE) return `${sideTeam} ML`;
  if (i.market === Market.SPREAD) return `${sideTeam} spread`;
  if (i.market === Market.TOTAL) return `${overUnder} (game total)`;
  return `${i.teamSide === TeamSide.HOME ? i.homeTeam : i.awayTeam} team total ${overUnder}`;
}

const hasLine = (m: Market) => m !== Market.MONEYLINE && m !== Market.PLAYER_PROP_YESNO;

// A research-sourced pick (from the odds board) already carries a real market/side/line/
// price, so it goes through a small confirm Modal (odds editable) instead of a form.
type PendingResearchPick = { kind: "team"; pick: TeamBetPick } | { kind: "prop"; pick: PropPick };

// Three clear paths:
//  - Editing an existing pick opens a compact line/odds editor (the usual reason to edit is a
//    moved line). "Change pick instead" drops into the full flow below.
//  - "Browse odds" (NFL): tap a real price on the odds board, confirm.
//  - "Enter my own bet": a guided, mostly-tap wizard (CustomBetWizard) for anything the board
//    doesn't have -- and the only path for leagues with no odds board.
export function PickLegForm({
  parlayId,
  initial,
  defaultLeague,
  onDone,
}: {
  parlayId: string;
  initial?: Initial;
  // A hint, not a restriction -- seeds the Sport selector (a "1pm" parlay defaults to NFL).
  defaultLeague: string;
  onDone?: () => void;
}) {
  const [sport, setSport] = useState<Sport>(() => initialSport(initial?.league ?? defaultLeague));
  const [mode, setMode] = useState<"odds" | "own">("odds");
  const [inlineEdit, setInlineEdit] = useState(Boolean(initial));
  const [line, setLine] = useState(initial?.line?.toString() ?? "");
  const [price, setPrice] = useState(initial?.price?.toString() ?? "");
  const [pendingResearchPick, setPendingResearchPick] = useState<PendingResearchPick | null>(null);
  const [researchPrice, setResearchPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const league = sport === "other" ? "" : sport;
  const hasOddsBoard = league === "NFL";
  const showOdds = hasOddsBoard && mode === "odds";

  function onSelectResearch(next: PendingResearchPick) {
    setError(null);
    setResearchPrice(next.pick.price.toString());
    setPendingResearchPick(next);
  }

  function confirmResearchPick() {
    if (!pendingResearchPick) return;
    const { kind, pick } = pendingResearchPick;
    setError(null);
    startTransition(async () => {
      const result = await pickLeg(parlayId, {
        homeTeam: pick.homeTeam,
        awayTeam: pick.awayTeam,
        league,
        market: pick.market,
        side: pick.side,
        teamSide: kind === "team" ? (pick.teamSide ?? null) : null,
        line: pick.line?.toString() ?? "",
        price: researchPrice,
        playerName: kind === "prop" ? pick.playerName : "",
        propType: kind === "prop" ? pick.propType : "",
        externalId: pick.externalId,
      });
      if (result?.error) setError(result.error);
      else {
        setPendingResearchPick(null);
        onDone?.();
      }
    });
  }

  function saveInlineEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial) return;
    setError(null);
    startTransition(async () => {
      const result = await pickLeg(parlayId, {
        homeTeam: initial.homeTeam,
        awayTeam: initial.awayTeam,
        league: initial.league ?? league,
        market: initial.market,
        side: initial.side,
        teamSide: initial.teamSide,
        line: hasLine(initial.market) ? line : "",
        price,
        playerName: initial.playerName ?? "",
        propType: initial.propType ?? "",
        externalId: "",
      });
      if (result?.error) setError(result.error);
      else onDone?.();
    });
  }

  if (inlineEdit && initial) {
    const editLeague = initial.league ?? league;
    return (
      <form onSubmit={saveInlineEdit} className="flex flex-col gap-3">
        <Card className="flex flex-col gap-3 border-border-strong p-4 shadow-xl shadow-black/50">
          <div className="flex items-center justify-center gap-2">
            <TeamLabel name={initial.awayTeam} logo={teamLogoUrl(editLeague, initial.awayTeam)} league={editLeague} />
            <span className="shrink-0 text-xs text-subtle">@</span>
            <TeamLabel name={initial.homeTeam} logo={teamLogoUrl(editLeague, initial.homeTeam)} league={editLeague} />
          </div>
          <p className="text-center text-base font-medium">{betLabelWithoutLine(initial)}</p>
          <div className={fieldListClass}>
            <div className={fieldRowClass}>
              {hasLine(initial.market) &&
                (initial.market === Market.SPREAD ? (
                  <SignedNumberInput label="Line" value={line} onChange={setLine} placeholder="Line" decimal defaultNegative inputClassName={groupFieldClass} />
                ) : (
                  <input
                    aria-label="Line"
                    value={line}
                    onChange={(e) => setLine(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Line"
                    autoComplete="off"
                    inputMode="decimal"
                    className={groupFieldClass}
                  />
                ))}
              <SignedNumberInput label="Odds" value={price} onChange={setPrice} placeholder="Odds" defaultNegative required inputClassName={groupFieldClass} />
            </div>
          </div>
          {error && <p className="text-xs text-loss">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Update pick"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                setInlineEdit(false);
              }}
            >
              Change pick instead
            </Button>
          </div>
        </Card>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <SegmentedControl size="sm" name="Sport" value={sport} onChange={setSport} options={SPORT_OPTIONS} />
        {hasOddsBoard && (
          <SegmentedControl
            size="sm"
            name="How"
            value={mode}
            onChange={setMode}
            options={[
              { value: "odds", label: "Browse odds" },
              { value: "own", label: "Enter my own bet" },
            ]}
          />
        )}
      </Card>

      {/* The odds board stays mounted (just hidden) while you're in "Enter my own" so its
          expanded game/tab survive switching back. Keyed on sport so a league change resets. */}
      {hasOddsBoard && (
        <div className={showOdds ? "flex flex-col gap-3" : "hidden"}>
          <ResearchBrowser
            key={sport}
            onSelectTeamBet={(pick) => onSelectResearch({ kind: "team", pick })}
            onSelectProp={(pick) => onSelectResearch({ kind: "prop", pick })}
          />
          <button type="button" onClick={() => setMode("own")} className={`${fieldListClass} px-4 py-3 text-left text-sm text-muted hover:text-foreground`}>
            Don&apos;t see your bet? <span className="font-medium text-accent">Enter my own bet →</span>
          </button>
        </div>
      )}

      {!showOdds && <CustomBetWizard key={sport} parlayId={parlayId} league={league} onDone={onDone} />}

      <Modal open={pendingResearchPick !== null} onClose={() => setPendingResearchPick(null)} title="Confirm pick">
        {pendingResearchPick && (
          <>
            <p className="text-sm text-muted">
              {pendingResearchPick.pick.awayTeam} @ {pendingResearchPick.pick.homeTeam}
            </p>
            <p className="mt-2 text-base font-medium">
              {legSummary(
                {
                  market: pendingResearchPick.pick.market,
                  side: pendingResearchPick.pick.side,
                  lineAtPick: pendingResearchPick.pick.line,
                  teamSide: pendingResearchPick.kind === "team" ? (pendingResearchPick.pick.teamSide ?? null) : null,
                  playerName: pendingResearchPick.kind === "prop" ? pendingResearchPick.pick.playerName : null,
                  propType: pendingResearchPick.kind === "prop" ? pendingResearchPick.pick.propType : null,
                },
                { homeTeam: pendingResearchPick.pick.homeTeam, awayTeam: pendingResearchPick.pick.awayTeam },
              )}
            </p>
            {/* Editable -- a vendor's price is a starting point; your book may show another. */}
            <div className={`${fieldListClass} mt-3`}>
              <div className={fieldRowClass}>
                <SignedNumberInput label="Odds" value={researchPrice} onChange={setResearchPrice} placeholder="Odds" required inputClassName={groupFieldClass} />
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-loss">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingResearchPick(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmResearchPick} disabled={pending}>
                {pending ? "Saving…" : "Confirm pick"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
