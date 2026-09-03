// Fuzzy team-name matching shared by anything that needs to correlate the "same real game"
// across two sources that don't share an id namespace -- originally written for
// app/parlays/actions.ts's ESPN event-id resolution, reused by lib/research/actions.ts's
// cross-provider fallback (matching a game from one research vendor's schedule against
// another vendor's, since their event ids are unrelated).
export function teamNamesMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.includes(y) || y.includes(x);
}
