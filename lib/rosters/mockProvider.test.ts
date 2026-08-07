import { describe, expect, it } from "vitest";

import { createMockRosterProvider } from "./mockProvider";

describe("createMockRosterProvider", () => {
  it("returns the fixture roster for a known team id", async () => {
    const provider = createMockRosterProvider();
    const players = await provider.getRoster("12");
    expect(players.some((p) => p.name === "Patrick Mahomes")).toBe(true);
  });

  it("returns an empty list for an unknown team id, not an error", async () => {
    const provider = createMockRosterProvider();
    const players = await provider.getRoster("not-a-real-id");
    expect(players).toEqual([]);
  });
});
