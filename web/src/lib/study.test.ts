import { describe, expect, it } from "vitest";
import type { Flashcard } from "./flashcards";
import {
  selectDeck,
  selectDeckByCollections,
  shuffle,
  weightedSampleWithoutReplacement,
} from "./study";

/** A random source that yields a fixed sequence, looping if exhausted. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("shuffle", () => {
  it("keeps every element exactly once (a permutation)", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, sequence([0.1, 0.7, 0.3, 0.9]));

    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input, sequence([0.5]));

    expect(input).toEqual(copy);
  });

  it("is deterministic given the same random source", () => {
    const input = ["a", "b", "c", "d"];
    const a = shuffle(input, sequence([0.2, 0.8, 0.4]));
    const b = shuffle(input, sequence([0.2, 0.8, 0.4]));

    expect(a).toEqual(b);
  });

  it("actually reorders when the random source calls for swaps", () => {
    // random() === 0 makes every j = 0, reversing the array end-over-start.
    const out = shuffle([1, 2, 3], sequence([0]));

    expect(out).not.toEqual([1, 2, 3]);
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([], sequence([0.5]))).toEqual([]);
    expect(shuffle([42], sequence([0.5]))).toEqual([42]);
  });
});

describe("weightedSampleWithoutReplacement", () => {
  const identity = (x: number) => x;

  it("draws at most `count` distinct items", () => {
    const out = weightedSampleWithoutReplacement(
      [1, 2, 3, 4, 5],
      () => 1,
      3,
      sequence([0.1, 0.5, 0.9, 0.3]),
    );
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const item of out) expect([1, 2, 3, 4, 5]).toContain(item);
  });

  it("returns every item when `count` is at least the length", () => {
    const out = weightedSampleWithoutReplacement(
      [1, 2, 3],
      identity,
      10,
      sequence([0.5, 0.2, 0.8]),
    );
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("returns an empty array for an empty input", () => {
    expect(
      weightedSampleWithoutReplacement([], identity, 5, sequence([0.5])),
    ).toEqual([]);
  });

  it("favours heavier items given the same random draw", () => {
    // Weights [1, 2, 3] span cumulative ranges [0,1), [1,3), [3,6) over total 6.
    // random()*6 lands the threshold in the chosen item's range.
    expect(
      weightedSampleWithoutReplacement([1, 2, 3], identity, 1, sequence([0.9])),
    ).toEqual([3]); // 0.9*6 = 5.4 → falls in 3's range
    expect(
      weightedSampleWithoutReplacement([1, 2, 3], identity, 1, sequence([0.05])),
    ).toEqual([1]); // 0.05*6 = 0.3 → falls in 1's range
  });

  it("falls back to a uniform pick when every weight is zero", () => {
    const out = weightedSampleWithoutReplacement(
      [1, 2, 3],
      () => 0,
      2,
      sequence([0.5, 0.5]),
    );
    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(2);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    weightedSampleWithoutReplacement(input, identity, 2, sequence([0.5]));
    expect(input).toEqual(copy);
  });
});

describe("selectDeck", () => {
  const cards: Flashcard[] = [
    { id: "1", japanese: "猫", english: "cat", collection: "Animals" },
    { id: "2", japanese: "犬", english: "dog", collection: "Animals" },
    { id: "3", japanese: "本", english: "book", collection: "Objects" },
  ];

  it("returns every card when the collection is null", () => {
    expect(selectDeck(cards, null)).toEqual(cards);
  });

  it("returns only the cards in the chosen collection, in order", () => {
    expect(selectDeck(cards, "Animals")).toEqual([cards[0], cards[1]]);
    expect(selectDeck(cards, "Objects")).toEqual([cards[2]]);
  });

  it("returns an empty array for an unknown collection", () => {
    expect(selectDeck(cards, "Verbs")).toEqual([]);
  });
});

describe("selectDeckByCollections", () => {
  const cards: Flashcard[] = [
    { id: "1", japanese: "猫", english: "cat", collection: "Mammals" },
    { id: "2", japanese: "鳥", english: "bird", collection: "Birds" },
    { id: "3", japanese: "本", english: "book", collection: "Objects" },
  ];

  it("returns cards across all the given collections, in order", () => {
    expect(selectDeckByCollections(cards, ["Mammals", "Birds"])).toEqual([
      cards[0],
      cards[1],
    ]);
  });

  it("returns an empty array when no collections are given", () => {
    expect(selectDeckByCollections(cards, [])).toEqual([]);
  });

  it("ignores collection names with no matching cards", () => {
    expect(selectDeckByCollections(cards, ["Objects", "Ghosts"])).toEqual([
      cards[2],
    ]);
  });
});
