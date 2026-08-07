import { describe, expect, it } from "vitest";

import { canPickGame } from "./legConstraints";

describe("canPickGame", () => {
  it("allows a game nobody else has picked", () => {
    expect(canPickGame("g1", false, [{ gameId: "g2" }])).toEqual({ ok: true });
  });

  it("rejects a game another member already picked, in a multi-game window", () => {
    const result = canPickGame("g1", false, [{ gameId: "g1" }]);
    expect(result.ok).toBe(false);
  });

  it("allows a duplicate game when the window is a single-game slot (SNF/TNF/MNF)", () => {
    expect(canPickGame("g1", true, [{ gameId: "g1" }])).toEqual({ ok: true });
  });

  it("allows picking your own already-picked game (caller excludes own leg)", () => {
    expect(canPickGame("g1", false, [])).toEqual({ ok: true });
  });
});
