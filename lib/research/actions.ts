"use server";

import { getParlayApiProvider } from "@/lib/parlayapi";
import {
  buildGameLinesGames as buildParlayApiGameLinesGames,
  buildResearchGame as buildParlayApiGame,
  summarizeSchedule as summarizeParlayApiSchedule,
} from "@/lib/parlayapi/categorize";
import { ParlayApiProviderError } from "@/lib/parlayapi/types";
import { mergeResearchGames } from "@/lib/research/marketUtils";
import { recordLineSnapshot } from "@/lib/trends/record";
import { getSharpApiProvider } from "@/lib/sharpapi";
import {
  buildResearchGame as buildSharpApiGame,
  groupRowsByGame as buildSharpApiGameLinesGames,
  summarizeSchedule as summarizeSharpApiSchedule,
} from "@/lib/sharpapi/categorize";
import { SharpApiProviderError } from "@/lib/sharpapi/types";
import { getSportsGameOddsProvider } from "@/lib/sportsgameodds";
import { buildResearchGame as buildSgoGame, summarizeSchedule as summarizeSgoSchedule } from "@/lib/sportsgameodds/categorize";
import { SportsGameOddsProviderError } from "@/lib/sportsgameodds/types";
import { teamNamesMatch } from "@/lib/teamNamesMatch";

import type { ResearchGame, ResearchGameSummary, ResearchProviderSource } from "./types";

// ParlayAPI first -- confirmed via a real, apples-to-apples pull against the exact same live
// game (Patriots @ Seahawks) to carry meaningfully broader real coverage than either existing
// provider: 386 real DK/FD-priced selections for this one event alone (vs. SharpAPI's ~400
// rows across its whole catalog for the same game, and SportsGameOdds' narrower per-statID
// coverage before its own real fix), including real milestone-ladder tiers neither other
// vendor exposes. This is now the basis for federation (below), not just a fallback order --
// ParlayAPI's own real game/team identity is what every other provider gets matched against.
const PROVIDER_ORDER: ResearchProviderSource[] = ["parlayapi", "sportsgameodds", "sharpapi"];

function describeError(error: unknown): string {
  if (error instanceof SharpApiProviderError || error instanceof SportsGameOddsProviderError || error instanceof ParlayApiProviderError) {
    if (error.kind === "missing_key") return "Live odds research isn't configured yet.";
    if (error.kind === "rate_limited") return "Research is busy right now -- try again in a bit.";
  }
  return "Couldn't load research data.";
}

async function fetchSchedule(source: ResearchProviderSource): Promise<ResearchGameSummary[]> {
  if (source === "parlayapi") {
    const events = await getParlayApiProvider().listNflSchedule();
    return summarizeParlayApiSchedule(events);
  }
  if (source === "sportsgameodds") {
    const events = await getSportsGameOddsProvider().listNflSchedule();
    return summarizeSgoSchedule(events);
  }
  const rows = await getSharpApiProvider().listNflSchedule();
  return summarizeSharpApiSchedule(rows);
}

async function fetchEventOdds(source: ResearchProviderSource, eventId: string): Promise<ResearchGame | null> {
  if (source === "parlayapi") {
    const data = await getParlayApiProvider().getNflEventOdds(eventId);
    return buildParlayApiGame(eventId, data);
  }
  if (source === "sportsgameodds") {
    const event = await getSportsGameOddsProvider().getNflEventOdds(eventId);
    return event ? buildSgoGame(event) : null;
  }
  const rows = await getSharpApiProvider().getNflEventOdds(eventId);
  return buildSharpApiGame(rows);
}

// rate_limited/upstream_error mean "this provider is temporarily unavailable, try the next
// one" for schedule discovery below. missing_key deliberately does NOT fall back there -- a
// real misconfiguration that should surface directly rather than being silently masked by a
// fallback that happens to work. (Federated game-odds fetching below treats every failure
// kind the same way -- see getNflGameOdds' own comment for why that's the right call there.)
function isFallbackWorthy(error: unknown): boolean {
  if (error instanceof SharpApiProviderError || error instanceof SportsGameOddsProviderError || error instanceof ParlayApiProviderError) {
    return error.kind === "rate_limited" || error.kind === "upstream_error";
  }
  return false;
}

// Keeps a real game with an unconfirmed kickoff time (commenceTime: null -- see
// ResearchGameSummary's own comment) rather than dropping it just because we can't judge
// it, and drops a real game whose confirmed kickoff has already passed -- this app only
// ever shows pregame lines (no live/in-play odds support at all), so a game past kickoff
// has nothing meaningful left to browse here regardless of whether it's still actually in
// progress or has fully finished; a vendor's own schedule feed doesn't reliably drop a game
// from its list the moment it starts, confirmed real (a friend reported still seeing
// already-started games in the browse list).
function isUpcoming(game: ResearchGameSummary): boolean {
  if (game.commenceTime === null) return true;
  return new Date(game.commenceTime).getTime() > Date.now();
}

// Cheap schedule discovery -- tries providers in PROVIDER_ORDER, falling back to the next on
// a real failure (not a missing configuration). ResearchBrowser calls this once to list real
// games, with no odds attached yet; odds for a specific game are only fetched once the user
// drills in (getNflGameOdds below). Not federated (merged) itself -- the real value of
// federation is more MARKETS per game, and NFL schedules are already nearly identical across
// vendors, so there's little to gain merging game *lists* the way there is merging odds.
//
// isUpcoming is applied here, not inside fetchSchedule() itself -- resolveOnProvider() below
// also calls fetchSchedule() to re-find an already-open game on a second federated provider,
// and that lookup must never be time-filtered: a game the user is actively viewing can kick
// off while they're still looking at it, and federation should keep working for it, not
// start silently dropping providers just because kickoff passed mid-view.
export async function getNflSchedule(): Promise<{ games: ResearchGameSummary[] } | { error: string }> {
  let lastError: unknown;
  for (const source of PROVIDER_ORDER) {
    try {
      return { games: (await fetchSchedule(source)).filter(isUpcoming) };
    } catch (error) {
      // Logged, not just turned into a generic user-facing string -- describeError()
      // deliberately collapses every real failure into one of three short messages, which
      // previously meant a genuine bug or a real vendor outage left zero trace anywhere.
      console.error(`[research] getNflSchedule: ${source} failed`, error);
      lastError = error;
      if (!isFallbackWorthy(error)) return { error: describeError(error) };
    }
  }
  return { error: describeError(lastError) };
}

// Whole-slate Game Lines for the schedule browser's eager, DK-style board (see
// ResearchBrowser.tsx) -- federates the same three providers getNflGameOdds does below, but
// scoped to ONE bulk call per provider covering every game at once instead of one call per
// game. SharpAPI's and SportsGameOdds' calls here are the exact same schedule fetch
// getNflSchedule already makes (durable-cached, so calling it again here is normally a cache
// hit, not a new network call) -- both already return real priced Game Lines rows/odds that
// summarizeSchedule/summarizeSgoSchedule simply never read; only ParlayAPI needs a genuinely
// new bulk call (listNflGameLines, no eventIds filter -- confirmed real: one 3-credit call
// covers the whole slate). Matched onto the passed-in canonical `schedule` (already resolved
// by getNflSchedule) by team name, the same teamNamesMatch pattern resolveOnProvider uses
// below -- a real game with no match from any provider (nothing posted yet) simply has no key
// in the result, not an error. Returns a plain object, not a Map, since server actions must
// return serializable values.
export async function getNflScheduleGameLines(schedule: ResearchGameSummary[]): Promise<Record<string, ResearchGame>> {
  const results = await Promise.allSettled([
    getParlayApiProvider().listNflGameLines().then(buildParlayApiGameLinesGames),
    getSportsGameOddsProvider()
      .listNflSchedule()
      .then((events) => events.map(buildSgoGame).filter((g): g is ResearchGame => g !== null)),
    getSharpApiProvider().listNflSchedule().then(buildSharpApiGameLinesGames),
  ]);

  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[research] getNflScheduleGameLines: provider ${PROVIDER_ORDER[i]} failed`, r.reason);
  });

  const perProviderGames = results
    .filter((r): r is PromiseFulfilledResult<ResearchGame[]> => r.status === "fulfilled")
    .map((r) => r.value);

  const out: Record<string, ResearchGame> = {};
  for (const summary of schedule) {
    const matches = perProviderGames.flatMap((games) =>
      games.filter((g) => teamNamesMatch(g.homeTeam, summary.homeTeam) && teamNamesMatch(g.awayTeam, summary.awayTeam)),
    );
    if (matches.length > 0) out[summary.externalId] = mergeResearchGames(matches);
  }
  return out;
}

// Resolves the same real-world matchup on a given provider by team-name matching, reusing the
// exact pattern app/parlays/actions.ts's ESPN event-id resolution already uses
// (lib/teamNamesMatch.ts) -- event ids are vendor-specific, so finding the same real game on
// a provider other than the one ResearchBrowser tagged it with means searching by team name,
// not by id.
async function resolveOnProvider(source: ResearchProviderSource, homeTeam: string, awayTeam: string) {
  const schedule = await fetchSchedule(source);
  const match = schedule.find((g) => teamNamesMatch(g.homeTeam, homeTeam) && teamNamesMatch(g.awayTeam, awayTeam));
  return match ? fetchEventOdds(source, match.externalId) : null;
}

// Federated odds+props for one specific game: fetches the tagged provider directly by its own
// eventId, AND every other configured provider by resolving the same real matchup via team
// names, in parallel -- then merges every provider that actually returned something into one
// ResearchGame (see mergeResearchGames' own dedupe logic for how the same real book/bet
// reported by two vendors collapses to one entry instead of showing twice). This is genuinely
// "fetch everyone, keep what works," not the old single-provider-with-fallback design: any one
// provider being down, misconfigured, or simply not covering this game is not a failure here,
// it's just one fewer contributor to the merge. The whole call only fails if literally every
// provider came back empty or errored.
export async function getNflGameOdds(
  eventId: string,
  source: ResearchProviderSource,
  homeTeam: string,
  awayTeam: string,
): Promise<{ game: ResearchGame } | { error: string }> {
  const results = await Promise.allSettled(
    PROVIDER_ORDER.map((candidate) =>
      candidate === source ? fetchEventOdds(candidate, eventId) : resolveOnProvider(candidate, homeTeam, awayTeam),
    ),
  );

  // Logged per-provider, not just the primary's -- a real federation failure (e.g. every
  // provider erroring for a genuinely different reason) is invisible otherwise, since only
  // one provider's error ever reaches the user-facing message below.
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[research] getNflGameOdds: ${PROVIDER_ORDER[i]} failed`, r.reason);
  });

  const games = results
    .filter((r): r is PromiseFulfilledResult<ResearchGame | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((g): g is ResearchGame => g !== null);

  if (games.length > 0) {
    const merged = mergeResearchGames(games);
    // Fire-and-forget: every real game-detail view (the pick flow and the /research page
    // alike) feeds the free trend database (lib/trends/) this way, but a snapshot failing
    // to record must never fail or slow down the odds response it's riding along with.
    recordLineSnapshot("NFL", merged).catch((error) => console.error("[research] recordLineSnapshot failed", error));
    return { game: merged };
  }

  // Nothing to merge -- report the tagged (primary) provider's own failure if it had one,
  // since that's the most actionable one for whoever's looking at this; a real event with
  // genuinely no odds posted anywhere yet isn't a provider failure at all.
  const primaryResult = results[PROVIDER_ORDER.indexOf(source)];
  if (primaryResult.status === "rejected") return { error: describeError(primaryResult.reason) };
  return { error: "No odds posted for this game yet." };
}
