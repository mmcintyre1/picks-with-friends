import { LegResult } from "@/app/generated/prisma/enums";
import { PlayerName } from "@/components/PlayerName";
import { Card } from "@/components/ui/Card";

import { StreakPill } from "./streakPill";

export type LeaderboardRow = {
  name: string;
  flair: string | null;
  // The real overall tally -- every non-push leg is exactly one of the four badges below,
  // so wins/losses already equal moneybag+cross and poo+toilet. Kept as real fields rather
  // than recomputed here, since the headline record must include lone wins/losses.
  wins: number;
  losses: number;
  moneybag: number;
  poo: number;
  toilet: number;
  cross: number;
  pushes: number;
  last10: { wins: number; losses: number };
  streak: { result: LegResult; count: number } | null;
  bestStreak: number;
  worstStreak: number;
};

const thClass = "px-1.5 pb-2 pt-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-subtle";
const tdClass = "px-1.5 py-2.5 text-center tabular-nums";
const nameThClass = "pb-2 pl-3 pr-1.5 pt-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-subtle";
const nameTdClass = "py-2.5 pl-3 pr-1.5 text-left font-medium";

function Dash() {
  return <span className="text-subtle">—</span>;
}

// Mobile: two compact tables with everyone visible at once, instead of one collapsible card
// per person -- comparing friends is the whole point, and tapping open each card to see
// anyone's numbers made that a chore. The 10-column desktop table has no room on a phone,
// so its columns are split across two short tables that each fit a 360px screen.
export function MobileStatsTables({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={nameThClass}>Record</th>
              <th className={thClass} title="Real overall record, lone wins/losses included">W-L</th>
              <th className={thClass} title="Push — tied, stake back">🆓</th>
              <th className={thClass} title="Record over the last 10 decided legs">L10</th>
              <th className={`${thClass} pr-3`} title="Current streak">Now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.name} className={i % 2 === 1 ? "bg-white/[0.02]" : undefined}>
                <td className={nameTdClass}>
                  <PlayerName name={row.name} flair={row.flair} />
                </td>
                <td className={`${tdClass} font-display text-base tracking-wide`}>
                  {row.wins}-{row.losses}
                </td>
                <td className={`${tdClass} text-push`}>{row.pushes}</td>
                <td className={`${tdClass} text-muted`}>
                  {row.last10.wins}-{row.last10.losses}
                </td>
                <td className={`${tdClass} pr-3`}>
                  {row.streak ? <StreakPill count={row.streak.count} isWin={row.streak.result === LegResult.WIN} /> : <Dash />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={nameThClass}>Awards</th>
              <th className={thClass} title="Cross — the lone win in an otherwise-losing parlay">✝️</th>
              <th className={thClass} title="Trash can — the lone loss in an otherwise-winning parlay">🗑️</th>
              <th className={thClass} title="Best-ever win streak">Best</th>
              <th className={`${thClass} pr-3`} title="Worst-ever losing streak">Worst</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.name} className={i % 2 === 1 ? "bg-white/[0.02]" : undefined}>
                <td className={nameTdClass}>
                  <PlayerName name={row.name} flair={row.flair} />
                </td>
                <td className={`${tdClass} text-win`}>{row.cross}</td>
                <td className={`${tdClass} text-loss`}>{row.toilet}</td>
                <td className={tdClass}>{row.bestStreak > 0 ? <StreakPill count={row.bestStreak} isWin={true} /> : <Dash />}</td>
                <td className={`${tdClass} pr-3`}>
                  {row.worstStreak > 0 ? <StreakPill count={row.worstStreak} isWin={false} /> : <Dash />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
