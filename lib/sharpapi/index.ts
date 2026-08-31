import { createMockSharpApiProvider } from "./mockProvider";
import { createSharpApiProvider } from "./sharpApiProvider";
import type { SharpApiProvider } from "./types";

let cached: SharpApiProvider | undefined;

// Defaults to mock, matching lib/odds/'s convention -- unlike lib/rosters/lib/schedule's
// free ESPN endpoints, SharpAPI needs a real key and has a real (if generous) rate limit,
// so it shouldn't be on by default in every dev environment. Set SHARPAPI_PROVIDER=sharpapi
// to use the real vendor.
export function getSharpApiProvider(): SharpApiProvider {
  if (cached) return cached;
  cached = process.env.SHARPAPI_PROVIDER === "sharpapi" ? createSharpApiProvider() : createMockSharpApiProvider();
  return cached;
}
