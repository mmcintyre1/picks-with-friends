import { createEspnScheduleProvider } from "./espnProvider";
import { createMockScheduleProvider } from "./mockProvider";
import type { ScheduleProvider } from "./types";

let cached: ScheduleProvider | undefined;

// Defaults to the real ESPN provider, same reasoning as lib/rosters/index.ts -- this
// endpoint is free and needs no key. Set SCHEDULE_PROVIDER=mock to force the offline
// fixtures; tests import the factories directly instead of going through this.
export function getScheduleProvider(): ScheduleProvider {
  if (cached) return cached;
  cached = process.env.SCHEDULE_PROVIDER === "mock" ? createMockScheduleProvider() : createEspnScheduleProvider();
  return cached;
}
