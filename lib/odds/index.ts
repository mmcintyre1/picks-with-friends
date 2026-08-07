import { createMockProvider } from "./mockProvider";
import { createTheOddsApiProvider } from "./theOddsApiProvider";
import type { OddsProvider } from "./types";

let cached: OddsProvider | undefined;

// Selected once via ODDS_PROVIDER=mock|theoddsapi (defaults to mock, so local dev and
// tests never need an API key). Nothing outside lib/odds/ should import a vendor SDK.
export function getOddsProvider(): OddsProvider {
  if (cached) return cached;

  cached =
    process.env.ODDS_PROVIDER === "theoddsapi"
      ? createTheOddsApiProvider(process.env.ODDS_API_KEY ?? "")
      : createMockProvider();

  return cached;
}
