import { describe, expect, it } from "vitest";
import { applyRoundResults, statFor, type CardStats } from "./card-stats";

describe("statFor", () => {
  it("returns the stored stat for a known card", () => {
    const stats: CardStats = { a: { successes: 3, streak: 2 } };
    expect(statFor(stats, "a")).toEqual({ successes: 3, streak: 2 });
  });

  it("returns a zeroed stat for an unknown card", () => {
    expect(statFor({}, "missing")).toEqual({ successes: 0, streak: 0 });
  });
});

describe("applyRoundResults", () => {
  it("counts a first success from nothing", () => {
    expect(applyRoundResults({}, { a: "right" })).toEqual({
      a: { successes: 1, streak: 1 },
    });
  });

  it("accumulates successes and extends the streak across runs", () => {
    let stats: CardStats = {};
    stats = applyRoundResults(stats, { a: "right" });
    stats = applyRoundResults(stats, { a: "right" });
    stats = applyRoundResults(stats, { a: "right" });
    expect(stats.a).toEqual({ successes: 3, streak: 3 });
  });

  it("resets the streak on a miss but keeps the total successes", () => {
    const before: CardStats = { a: { successes: 5, streak: 5 } };
    expect(applyRoundResults(before, { a: "wrong" })).toEqual({
      a: { successes: 5, streak: 0 },
    });
  });

  it("rebuilds the streak after a miss", () => {
    let stats: CardStats = { a: { successes: 5, streak: 0 } };
    stats = applyRoundResults(stats, { a: "right" });
    expect(stats.a).toEqual({ successes: 6, streak: 1 });
  });

  it("applies a mix of right and wrong in a single round", () => {
    const before: CardStats = {
      a: { successes: 2, streak: 2 },
      b: { successes: 1, streak: 1 },
    };
    const after = applyRoundResults(before, { a: "right", b: "wrong", c: "right" });
    expect(after).toEqual({
      a: { successes: 3, streak: 3 },
      b: { successes: 1, streak: 0 },
      c: { successes: 1, streak: 1 },
    });
  });

  it("leaves cards absent from the round untouched", () => {
    const before: CardStats = { a: { successes: 4, streak: 4 } };
    expect(applyRoundResults(before, { b: "right" })).toEqual({
      a: { successes: 4, streak: 4 },
      b: { successes: 1, streak: 1 },
    });
  });

  it("does not mutate the input stats", () => {
    const before: CardStats = { a: { successes: 1, streak: 1 } };
    applyRoundResults(before, { a: "right" });
    expect(before).toEqual({ a: { successes: 1, streak: 1 } });
  });
});
