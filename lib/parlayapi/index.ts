import { createMockParlayApiProvider } from "./mockProvider";
import { createParlayApiProvider } from "./parlayApiProvider";
import type { ParlayApiProvider } from "./types";

let cached: ParlayApiProvider | undefined;

// Defaults to mock, matching every other real-vendor provider's convention in this app.
// Set PARLAYAPI_PROVIDER=parlayapi to use the real vendor (needs PARLAY_API_KEY).
export function getParlayApiProvider(): ParlayApiProvider {
  if (cached) return cached;
  cached = process.env.PARLAYAPI_PROVIDER === "parlayapi" ? createParlayApiProvider() : createMockParlayApiProvider();
  return cached;
}
