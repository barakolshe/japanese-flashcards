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
 * Sample up to `count` distinct items without replacement, with each item's
 * chance of being drawn proportional to `weight(item)`. Returns a new array in
 * the order drawn; the input is never mutated. When `count` is at least the
 * number of items, every item is returned (in a weighted-random order).
 *
 * `random` must behave like {@link Math.random} — return a float in `[0, 1)`.
 * It is passed in (not defaulted) so callers are explicit and tests can supply
 * a deterministic source. Weights must be finite and non-negative; once every
 * remaining item has weight 0 the rest are drawn uniformly at random, so the
 * function always returns the requested number of items when enough exist.
 */
export function weightedSampleWithoutReplacement<T>(
  items: T[],
  weight: (item: T) => number,
  count: number,
  random: () => number,
): T[] {
  const pool = [...items];
  const weights = pool.map(weight);
  const drawn: T[] = [];
  const target = Math.min(count, pool.length);

  for (let n = 0; n < target; n++) {
    let total = 0;
    for (const w of weights) total += w;

    let chosen: number;
    if (total > 0) {
      // Walk the cumulative weights until the running threshold goes negative.
      // Defaults to the last index if floating-point drift leaves it at zero.
      let threshold = random() * total;
      chosen = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        threshold -= weights[i];
        if (threshold < 0) {
          chosen = i;
          break;
        }
      }
    } else {
      // Everything left is weight 0 — fall back to a uniform pick so we still
      // return `target` items.
      chosen = Math.floor(random() * pool.length);
    }

    drawn.push(pool[chosen]);
    pool.splice(chosen, 1);
    weights.splice(chosen, 1);
  }

  return drawn;
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
