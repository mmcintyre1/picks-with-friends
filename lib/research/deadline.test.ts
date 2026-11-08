import { describe, expect, it, vi } from "vitest";

import { isTimeoutError, withDeadline } from "./deadline";

describe("withDeadline", () => {
  it("passes a fast result through", async () => {
    await expect(withDeadline(Promise.resolve(7), 1000, "fast")).resolves.toBe(7);
  });

  it("rejects when the work outlasts the deadline, without waiting for it", async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => {});
    const raced = withDeadline(never, 500, "hung vendor");
    vi.advanceTimersByTime(500);
    await expect(raced).rejects.toThrow("hung vendor gave no answer within 500ms");
    vi.useRealTimers();
  });

  it("passes the work's own failure through", async () => {
    await expect(withDeadline(Promise.reject(new Error("boom")), 1000, "x")).rejects.toThrow("boom");
  });
});

describe("isTimeoutError", () => {
  it("recognizes a fetch timeout", () => {
    expect(isTimeoutError(new DOMException("timed out", "TimeoutError"))).toBe(true);
    expect(isTimeoutError(new Error("other"))).toBe(false);
  });
});
