import { createEspnProvider } from "./espnProvider";
import { createMockRosterProvider } from "./mockProvider";
import type { RosterProvider } from "./types";

let cached: RosterProvider | undefined;

// Defaults to the real ESPN provider (not mock) -- unlike lib/odds/, this endpoint is
// free and needs no API key, so there's no cost reason to hide it behind an opt-in.
// Set ROSTER_PROVIDER=mock to force the offline fixtures (used by local dev without
// network access; tests import the factories directly instead of going through this).
export function getRosterProvider(): RosterProvider {
  if (cached) return cached;
  cached = process.env.ROSTER_PROVIDER === "mock" ? createMockRosterProvider() : createEspnProvider();
  return cached;
}
