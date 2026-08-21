import { createEspnBoxScoreProvider } from "./espnProvider";
import { createMockBoxScoreProvider } from "./mockProvider";
import type { BoxScoreProvider } from "./types";

let cached: BoxScoreProvider | undefined;

// Defaults to the real ESPN provider, same reasoning as lib/rosters/index.ts and
// lib/schedule/index.ts -- this endpoint is free and needs no key. Set
// EVALUATE_PROVIDER=mock to force the offline fixtures; tests import the factories
// directly instead of going through this.
export function getBoxScoreProvider(): BoxScoreProvider {
  if (cached) return cached;
  cached = process.env.EVALUATE_PROVIDER === "mock" ? createMockBoxScoreProvider() : createEspnBoxScoreProvider();
  return cached;
}
