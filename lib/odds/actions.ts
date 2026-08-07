"use server";

import { getOddsProvider } from "./index";
import { toSportKeys } from "./leagueMap";
import { roundDownToBucket } from "./timeBucket";
import { OddsProviderError, type ProviderGame, type ProviderProp } from "./types";

// Live odds failing must never block manual entry or crash the pick page -- every path
// here resolves to a typed { error } rather than throwing across the server action
// boundary, so the client can just show the message and fall back to manual entry.
function describeError(error: unknown): string {
  if (error instanceof OddsProviderError) {
    switch (error.kind) {
      case "missing_key":
        return "Live odds aren't configured for this app yet.";
      case "quota_exceeded":
        return "Live odds are temporarily unavailable (monthly quota reached).";
      case "not_found":
        return "That game's odds weren't found.";
      case "upstream_error":
        return "Live odds are temporarily unavailable.";
    }
  }
  return "Couldn't load live odds.";
}

// Bounds the bulk fetch to roughly the current NFL week (Thu-Mon slate) -- without this,
// the API returns every remaining game in the season (hundreds), not just the ones
// anyone would plausibly be picking right now.
const UPCOMING_WINDOW_DAYS = 8;
const BUCKET_MINUTES = 10;

export async function getLiveGames(league: string): Promise<{ games: ProviderGame[] } | { error: string }> {
  const sportKeys = toSportKeys(league);
  if (!sportKeys) return { error: `Live odds aren't available for ${league}.` };

  const commenceFrom = roundDownToBucket(new Date(), BUCKET_MINUTES);
  const commenceTo = new Date(commenceFrom.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Each league can map to more than one sport key (e.g. NFL preseason + regular season
  // are separate keys) -- query all of them and merge, so a quota/upstream error on one
  // doesn't wipe out results that succeeded on another.
  const settled = await Promise.allSettled(
    sportKeys.map((sportKey) => getOddsProvider().listGamesWithOdds(sportKey, { commenceFrom, commenceTo })),
  );

  const games = settled
    .filter((r): r is PromiseFulfilledResult<ProviderGame[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));

  if (games.length === 0) {
    const firstFailure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (firstFailure) return { error: describeError(firstFailure.reason) };
  }

  return { games };
}

export async function getGameProps(
  sportKey: string,
  eventId: string,
): Promise<{ props: ProviderProp } | { error: string }> {
  try {
    const props = await getOddsProvider().listPlayerProps(sportKey, eventId);
    return { props };
  } catch (error) {
    return { error: describeError(error) };
  }
}
