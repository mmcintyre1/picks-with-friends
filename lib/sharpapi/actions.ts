"use server";

import { buildResearchGame, summarizeSchedule } from "./categorize";
import { getSharpApiProvider } from "./index";
import { SharpApiProviderError, type ResearchGame, type ResearchGameSummary } from "./types";

function describeError(error: unknown): string {
  if (error instanceof SharpApiProviderError) {
    if (error.kind === "missing_key") return "Live odds research isn't configured yet.";
    if (error.kind === "rate_limited") return "Research is busy right now -- try again in a bit.";
  }
  return "Couldn't load research data.";
}

// Cheap schedule discovery -- ResearchBrowser calls this once to list real games, with no
// odds attached yet. Odds/props for a specific game are only fetched once the user drills
// into it (getNflGameOdds below), the same "browse free, spend on what you click" shape
// ScheduleBrowser/the old LiveOddsBrowser already used against other providers.
export async function getNflSchedule(): Promise<{ games: ResearchGameSummary[] } | { error: string }> {
  try {
    const rows = await getSharpApiProvider().listNflSchedule();
    return { games: summarizeSchedule(rows) };
  } catch (error) {
    return { error: describeError(error) };
  }
}

export async function getNflGameOdds(eventId: string): Promise<{ game: ResearchGame } | { error: string }> {
  try {
    const rows = await getSharpApiProvider().getNflEventOdds(eventId);
    const game = buildResearchGame(rows);
    if (!game) return { error: "No odds posted for this game yet." };
    return { game };
  } catch (error) {
    return { error: describeError(error) };
  }
}
