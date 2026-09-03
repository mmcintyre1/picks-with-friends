export type AtsResult = "cover" | "loss" | "push";
export type OuResult = "over" | "under" | "push";

export type TrackedGameLine = {
  spreadHome: number | null;
  total: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

// Evaluates one real, tracked game from one specific team's perspective. ats/ou are
// computed independently and can each be null on their own -- a real game can have a
// tracked spread but no tracked total (or vice versa) if the vendor never posted one, and a
// missing half shouldn't block computing the other.
//
// Deliberately its own small function rather than a reuse of lib/evaluate/resolveLeg.ts's
// resolveOverUnder: that one is keyed to a betting Side (OVER/UNDER a line a specific leg
// picked), this is keyed to which TEAM the trend is being computed for -- a genuinely
// different shape, not the same job wearing a different name.
export function evaluateGame(game: TrackedGameLine, team: "home" | "away"): { ats: AtsResult | null; ou: OuResult | null } {
  const { spreadHome, total, homeScore, awayScore } = game;
  const hasScore = homeScore !== null && awayScore !== null;

  let ats: AtsResult | null = null;
  if (hasScore && spreadHome !== null) {
    const teamSpread = team === "home" ? spreadHome : -spreadHome;
    const margin = team === "home" ? homeScore - awayScore : awayScore - homeScore;
    const coverMargin = margin + teamSpread;
    ats = coverMargin > 0 ? "cover" : coverMargin < 0 ? "loss" : "push";
  }

  let ou: OuResult | null = null;
  if (hasScore && total !== null) {
    const combined = homeScore + awayScore;
    ou = combined > total ? "over" : combined < total ? "under" : "push";
  }

  return { ats, ou };
}

export type TeamTrend = {
  ats: { covers: number; losses: number; pushes: number; sampleSize: number };
  ou: { overs: number; unders: number; pushes: number; sampleSize: number };
};

// Reduces a team's evaluated games into a trend record. Each half's sampleSize only counts
// games that half could actually be evaluated for, so a game missing a total doesn't
// silently shrink the ATS sample (or vice versa) -- the two halves are independent tallies.
export function summarizeTrend(results: { ats: AtsResult | null; ou: OuResult | null }[]): TeamTrend {
  const trend: TeamTrend = {
    ats: { covers: 0, losses: 0, pushes: 0, sampleSize: 0 },
    ou: { overs: 0, unders: 0, pushes: 0, sampleSize: 0 },
  };

  for (const r of results) {
    if (r.ats === "cover") trend.ats.covers++;
    else if (r.ats === "loss") trend.ats.losses++;
    else if (r.ats === "push") trend.ats.pushes++;
    if (r.ats !== null) trend.ats.sampleSize++;

    if (r.ou === "over") trend.ou.overs++;
    else if (r.ou === "under") trend.ou.unders++;
    else if (r.ou === "push") trend.ou.pushes++;
    if (r.ou !== null) trend.ou.sampleSize++;
  }

  return trend;
}
