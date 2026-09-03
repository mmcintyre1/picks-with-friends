"use server";

import { getSharpApiProvider } from "@/lib/sharpapi";
import { buildResearchGame as buildSharpApiGame, summarizeSchedule as summarizeSharpApiSchedule } from "@/lib/sharpapi/categorize";
import { SharpApiProviderError } from "@/lib/sharpapi/types";
import { getSportsGameOddsProvider } from "@/lib/sportsgameodds";
import { buildResearchGame as buildSgoGame, summarizeSchedule as summarizeSgoSchedule } from "@/lib/sportsgameodds/categorize";
import { SportsGameOddsProviderError } from "@/lib/sportsgameodds/types";
import { teamNamesMatch } from "@/lib/teamNamesMatch";

import type { ResearchGame, ResearchGameSummary, ResearchProviderSource } from "./types";

// SportsGameOdds first -- confirmed via a real, apples-to-apples comparison this session
// (same live game, same book) to carry meaningfully broader real coverage than SharpAPI
// (8 distinct DK player-prop market types vs 4, 22 players vs 12, plus Anytime TD and
// Rush + Rec Yards -- both confirmed completely absent from SharpAPI's entire catalog).
// SharpAPI is the automatic fallback, not a manually-flipped default.
const PROVIDER_ORDER: ResearchProviderSource[] = ["sportsgameodds", "sharpapi"];

function otherProvider(source: ResearchProviderSource): ResearchProviderSource {
  return source === "sportsgameodds" ? "sharpapi" : "sportsgameodds";
}

// rate_limited/upstream_error mean "this provider is temporarily unavailable, try the next
// one." missing_key deliberately does NOT fall back -- it means this provider was
// explicitly configured to use its real vendor but the key is missing, a real
// misconfiguration that should surface directly rather than being silently masked by a
// fallback that happens to work.
function isFallbackWorthy(error: unknown): boolean {
  if (error instanceof SharpApiProviderError || error instanceof SportsGameOddsProviderError) {
    return error.kind === "rate_limited" || error.kind === "upstream_error";
  }
  return false;
}

function describeError(error: unknown): string {
  if (error instanceof SharpApiProviderError || error instanceof SportsGameOddsProviderError) {
    if (error.kind === "missing_key") return "Live odds research isn't configured yet.";
    if (error.kind === "rate_limited") return "Research is busy right now -- try again in a bit.";
  }
  return "Couldn't load research data.";
}

async function fetchSchedule(source: ResearchProviderSource): Promise<ResearchGameSummary[]> {
  if (source === "sportsgameodds") {
    const events = await getSportsGameOddsProvider().listNflSchedule();
    return summarizeSgoSchedule(events);
  }
  const rows = await getSharpApiProvider().listNflSchedule();
  return summarizeSharpApiSchedule(rows);
}

async function fetchEventOdds(source: ResearchProviderSource, eventId: string): Promise<ResearchGame | null> {
  if (source === "sportsgameodds") {
    const event = await getSportsGameOddsProvider().getNflEventOdds(eventId);
    return event ? buildSgoGame(event) : null;
  }
  const rows = await getSharpApiProvider().getNflEventOdds(eventId);
  return buildSharpApiGame(rows);
}

// Cheap schedule discovery -- tries the primary provider, falls back to the secondary on a
// real failure (not a missing configuration). ResearchBrowser calls this once to list real
// games, with no odds attached yet; odds for a specific game are only fetched once the user
// drills in (getNflGameOdds below).
export async function getNflSchedule(): Promise<{ games: ResearchGameSummary[] } | { error: string }> {
  let lastError: unknown;
  for (const source of PROVIDER_ORDER) {
    try {
      return { games: await fetchSchedule(source) };
    } catch (error) {
      lastError = error;
      if (!isFallbackWorthy(error)) return { error: describeError(error) };
    }
  }
  return { error: describeError(lastError) };
}

// Re-resolves the same real-world matchup on the other provider by team-name matching,
// reusing the exact pattern app/parlays/actions.ts's ESPN event-id resolution already uses
// (lib/teamNamesMatch.ts) -- event ids are vendor-specific, so a specific game's odds call
// failing on its original provider needs this to find the same real game elsewhere rather
// than retrying a meaningless id on the other provider.
async function resolveOnOtherProvider(source: ResearchProviderSource, homeTeam: string, awayTeam: string) {
  const schedule = await fetchSchedule(source);
  const match = schedule.find((g) => teamNamesMatch(g.homeTeam, homeTeam) && teamNamesMatch(g.awayTeam, awayTeam));
  return match ? fetchEventOdds(source, match.externalId) : null;
}

// Full odds+props for one specific game, sourced from whichever provider ResearchBrowser
// tagged it with when the schedule was fetched. If that specific call fails with a
// fallback-worthy error, re-resolves the same matchup on the other provider instead of
// just failing -- this is the per-game failover the multi-provider architecture exists for.
export async function getNflGameOdds(
  eventId: string,
  source: ResearchProviderSource,
): Promise<{ game: ResearchGame } | { error: string }> {
  try {
    const game = await fetchEventOdds(source, eventId);
    // A real event with genuinely no odds posted yet isn't a provider failure -- the other
    // provider almost certainly doesn't have it posted either, so don't bother falling back.
    return game ? { game } : { error: "No odds posted for this game yet." };
  } catch (error) {
    if (!isFallbackWorthy(error)) return { error: describeError(error) };
    try {
      // Need this game's real team names to re-resolve elsewhere -- re-fetch this
      // provider's own (cached, cheap) schedule rather than threading homeTeam/awayTeam
      // through every call site just for this rare fallback path.
      const originalSchedule = await fetchSchedule(source);
      const original = originalSchedule.find((g) => g.externalId === eventId);
      if (!original) return { error: describeError(error) };
      const fallbackGame = await resolveOnOtherProvider(otherProvider(source), original.homeTeam, original.awayTeam);
      return fallbackGame ? { game: fallbackGame } : { error: describeError(error) };
    } catch {
      return { error: describeError(error) };
    }
  }
}
