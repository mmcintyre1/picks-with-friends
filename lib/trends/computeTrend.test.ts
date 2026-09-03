import { describe, expect, it } from "vitest";

import { evaluateGame, summarizeTrend, type TrackedGameLine } from "./computeTrend";

function game(overrides: Partial<TrackedGameLine>): TrackedGameLine {
  return { spreadHome: null, total: null, homeScore: null, awayScore: null, ...overrides };
}

describe("evaluateGame -- ATS", () => {
  // Home favored by 3 (spreadHome -3).
  const favoredHome = { spreadHome: -3, total: null };

  it("home team covers when it wins by more than the spread", () => {
    const g = game({ ...favoredHome, homeScore: 27, awayScore: 20 }); // won by 7
    expect(evaluateGame(g, "home").ats).toBe("cover");
  });

  it("home team loses ATS when it wins by less than the spread", () => {
    const g = game({ ...favoredHome, homeScore: 21, awayScore: 20 }); // won by 1
    expect(evaluateGame(g, "home").ats).toBe("loss");
  });

  it("home team pushes when the margin exactly equals the spread", () => {
    const g = game({ ...favoredHome, homeScore: 23, awayScore: 20 }); // won by exactly 3
    expect(evaluateGame(g, "home").ats).toBe("push");
  });

  it("away team (getting +3) covers on a close loss", () => {
    const g = game({ ...favoredHome, homeScore: 22, awayScore: 20 }); // away lost by 2
    expect(evaluateGame(g, "away").ats).toBe("cover");
  });

  it("away team loses ATS on a loss bigger than the spread", () => {
    const g = game({ ...favoredHome, homeScore: 24, awayScore: 20 }); // away lost by 4
    expect(evaluateGame(g, "away").ats).toBe("loss");
  });

  it("is null when there's no tracked spread", () => {
    const g = game({ spreadHome: null, homeScore: 27, awayScore: 20 });
    expect(evaluateGame(g, "home").ats).toBeNull();
  });

  it("is null when there's no real final score yet", () => {
    const g = game({ spreadHome: -3, homeScore: null, awayScore: null });
    expect(evaluateGame(g, "home").ats).toBeNull();
  });
});

describe("evaluateGame -- O/U", () => {
  it("is over when the combined score exceeds the total", () => {
    const g = game({ total: 44.5, homeScore: 27, awayScore: 20 });
    expect(evaluateGame(g, "home").ou).toBe("over");
  });

  it("is under when the combined score is below the total", () => {
    const g = game({ total: 50.5, homeScore: 27, awayScore: 20 });
    expect(evaluateGame(g, "home").ou).toBe("under");
  });

  it("pushes when the combined score exactly equals the total", () => {
    const g = game({ total: 47, homeScore: 27, awayScore: 20 });
    expect(evaluateGame(g, "home").ou).toBe("push");
  });

  it("is null when there's no tracked total", () => {
    const g = game({ total: null, homeScore: 27, awayScore: 20 });
    expect(evaluateGame(g, "home").ou).toBeNull();
  });

  it("ats and ou are independent -- a missing total doesn't block a real ATS result", () => {
    const g = game({ spreadHome: -3, total: null, homeScore: 27, awayScore: 20 });
    const result = evaluateGame(g, "home");
    expect(result.ats).toBe("cover");
    expect(result.ou).toBeNull();
  });
});

describe("summarizeTrend", () => {
  it("tallies covers/losses/pushes and overs/unders/pushes independently", () => {
    const trend = summarizeTrend([
      { ats: "cover", ou: "over" },
      { ats: "loss", ou: "under" },
      { ats: "cover", ou: "push" },
      { ats: "push", ou: "over" },
    ]);
    expect(trend.ats).toEqual({ covers: 2, losses: 1, pushes: 1, sampleSize: 4 });
    expect(trend.ou).toEqual({ overs: 2, unders: 1, pushes: 1, sampleSize: 4 });
  });

  it("a null half doesn't shrink the other half's sample size", () => {
    const trend = summarizeTrend([
      { ats: "cover", ou: null },
      { ats: null, ou: "over" },
    ]);
    expect(trend.ats).toEqual({ covers: 1, losses: 0, pushes: 0, sampleSize: 1 });
    expect(trend.ou).toEqual({ overs: 1, unders: 0, pushes: 0, sampleSize: 1 });
  });

  it("returns all-zero sample sizes for an empty list", () => {
    const trend = summarizeTrend([]);
    expect(trend.ats.sampleSize).toBe(0);
    expect(trend.ou.sampleSize).toBe(0);
  });
});
