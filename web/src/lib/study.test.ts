import { describe, expect, it } from "vitest";
import type { Flashcard } from "./flashcards";
import { selectDeck, shuffle } from "./study";

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

describe("selectDeck", () => {
  const cards: Flashcard[] = [
    { id: "1", japanese: "猫", english: "cat", folder: "Animals" },
    { id: "2", japanese: "犬", english: "dog", folder: "Animals" },
    { id: "3", japanese: "本", english: "book", folder: "Objects" },
  ];

  it("returns every card when the folder is null", () => {
    expect(selectDeck(cards, null)).toEqual(cards);
  });

  it("returns only the cards in the chosen folder, in order", () => {
    expect(selectDeck(cards, "Animals")).toEqual([cards[0], cards[1]]);
    expect(selectDeck(cards, "Objects")).toEqual([cards[2]]);
  });

  it("returns an empty array for an unknown folder", () => {
    expect(selectDeck(cards, "Verbs")).toEqual([]);
  });
});
