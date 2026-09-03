import { requireUserAndGroup } from "@/lib/session";

import { PlayerResearchBrowser } from "./PlayerResearchBrowser";

// Standalone research destination, decoupled from any specific parlay -- browse a real NFL
// game and see every player's props together (PocketProps-style), plus each team's free,
// app-owned ATS/O-U trend. Read-only for now (see the plan's Phase 2.22): making an actual
// pick still goes through a parlay's own pick flow.
export default async function ResearchPage() {
  await requireUserAndGroup("/research");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Research</h1>
        <p className="mt-1 text-sm text-muted">Browse a game to see every player&apos;s props together, plus each team&apos;s ATS/O-U trend.</p>
      </div>
      <PlayerResearchBrowser />
    </main>
  );
}
