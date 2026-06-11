import type { Flashcard } from "./flashcards";

/** The outcome the user records for a card during a study round. */
export type StudyResult = "right" | "wrong";

/**
 * Return a new array with the items reordered (Fisher–Yates).
 *
 * `random` must behave like {@link Math.random} — return a float in `[0, 1)`.
 * It is passed in (not defaulted) so callers are explicit and tests can supply
 * a deterministic source. The input array is never mutated.
 */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The cards to study for a chosen target: every card when `collection` is
 * `null`, otherwise only the cards in that collection (in their existing order).
 */
export function selectDeck(
  cards: Flashcard[],
  collection: string | null,
): Flashcard[] {
  if (collection === null) return cards;
  return cards.filter((card) => card.collection === collection);
}

/**
 * The cards to study for a whole folder: every card whose collection is one of
 * `collections`, in their existing order. Used when focusing on a folder, which
 * studies all the collections filed under it together.
 */
export function selectDeckByCollections(
  cards: Flashcard[],
  collections: string[],
): Flashcard[] {
  const set = new Set(collections);
  return cards.filter((card) => set.has(card.collection));
}
