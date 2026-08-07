import { describe, expect, it } from "vitest";

import { roundDownToBucket } from "./timeBucket";

describe("roundDownToBucket", () => {
  it("rounds down to the nearest bucket boundary", () => {
    expect(roundDownToBucket(new Date("2026-08-07T20:47:33.123Z"), 10)).toEqual(
      new Date("2026-08-07T20:40:00.000Z"),
    );
  });

  it("two calls within the same bucket produce an identical timestamp", () => {
    const a = roundDownToBucket(new Date("2026-08-07T20:40:01.000Z"), 10);
    const b = roundDownToBucket(new Date("2026-08-07T20:49:59.999Z"), 10);
    expect(a.getTime()).toBe(b.getTime());
  });

  it("calls in different buckets produce different timestamps", () => {
    const a = roundDownToBucket(new Date("2026-08-07T20:49:59.999Z"), 10);
    const b = roundDownToBucket(new Date("2026-08-07T20:50:00.000Z"), 10);
    expect(a.getTime()).not.toBe(b.getTime());
  });

  it("leaves an already-aligned timestamp unchanged", () => {
    const d = new Date("2026-08-07T20:40:00.000Z");
    expect(roundDownToBucket(d, 10)).toEqual(d);
  });
});
