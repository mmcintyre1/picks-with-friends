import type { ReadName, Reads } from "./reads";

// Client-side caller for lib/reads.ts -- same arguments and return value as calling the
// server function directly, but over fetch, so it runs in parallel with (and never blocks)
// the page's real server actions.
export async function read<K extends ReadName>(fn: K, ...args: Parameters<Reads[K]>): Promise<Awaited<ReturnType<Reads[K]>>> {
  const res = await fetch(`/api/read/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Lookup ${fn} failed (${res.status}).`);
  return res.json();
}
