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
 * The cards to study for a chosen target: every card when `folder` is `null`,
 * otherwise only the cards in that folder (in their existing order).
 */
export function selectDeck(
  cards: Flashcard[],
  folder: string | null,
): Flashcard[] {
  if (folder === null) return cards;
  return cards.filter((card) => card.folder === folder);
}
