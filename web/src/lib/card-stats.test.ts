import { describe, expect, it } from "vitest";
import {
  applyRoundResults,
  quizWeight,
  selectQuizDeck,
  statFor,
  type CardStats,
} from "./card-stats";
import type { Flashcard } from "./flashcards";

/** A random source that yields a fixed sequence, looping if exhausted. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

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

describe("quizWeight", () => {
  it("is 1 at streak 0 and halves as the streak grows", () => {
    expect(quizWeight({ successes: 0, streak: 0 })).toBe(1);
    expect(quizWeight({ successes: 9, streak: 1 })).toBe(0.5);
    expect(quizWeight({ successes: 9, streak: 3 })).toBe(0.25);
  });

  it("stays positive even at a very high streak", () => {
    const w = quizWeight({ successes: 999, streak: 999 });
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.01);
  });
});

describe("selectQuizDeck", () => {
  const cards: Flashcard[] = [
    { id: "1", japanese: "猫", english: "cat", collection: "A" },
    { id: "2", japanese: "犬", english: "dog", collection: "A" },
    { id: "3", japanese: "本", english: "book", collection: "B" },
    { id: "4", japanese: "水", english: "water", collection: "B" },
    { id: "5", japanese: "火", english: "fire", collection: "B" },
  ];

  it("returns every card (deduped) when fewer than `count` exist", () => {
    const out = selectQuizDeck(cards, {}, 50, sequence([0.5, 0.2, 0.8, 0.1]));
    expect(out).toHaveLength(5);
    expect(new Set(out.map((c) => c.id)).size).toBe(5);
  });

  it("draws exactly `count` distinct cards when the deck is larger", () => {
    const out = selectQuizDeck(cards, {}, 2, sequence([0.1, 0.6]));
    expect(out).toHaveLength(2);
    expect(new Set(out.map((c) => c.id)).size).toBe(2);
  });

  it("favours low-streak (weaker) words over high-streak ones", () => {
    // Two well-known words (streak 99 → weight ~0.01) and one weak word
    // (streak 0 → weight 1). The weak word dominates the cumulative range, so a
    // mid-range draw lands on it even though it's listed last.
    const stats: CardStats = {
      "1": { successes: 99, streak: 99 },
      "2": { successes: 99, streak: 99 },
      "3": { successes: 0, streak: 0 },
    };
    const pool = cards.slice(0, 3); // ids 1, 2, 3
    const out = selectQuizDeck(pool, stats, 1, sequence([0.5]));
    expect(out.map((c) => c.id)).toEqual(["3"]);
  });
});
