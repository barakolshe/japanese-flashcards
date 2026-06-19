import type { Flashcard } from "./flashcards";
import { weightedSampleWithoutReplacement, type StudyResult } from "./study";

/**
 * Running per-word study stats, accumulated across study runs and persisted
 * alongside the deck. Keyed by the card's id.
 */
export type CardStat = {
  /** Total number of times the word has been gotten right ("Got it"), ever. */
  successes: number;
  /** Consecutive successes without a miss; reset to 0 the moment it's missed. */
  streak: number;
};

/** Per-word stats, keyed by {@link Flashcard.id}. */
export type CardStats = Record<string, CardStat>;

/** The stored stat for a card, or a zeroed stat when it has none yet. */
export function statFor(stats: CardStats, cardId: string): CardStat {
  return stats[cardId] ?? { successes: 0, streak: 0 };
}

/**
 * Fold one completed run's results into the running stats, returning a new map
 * (the input is never mutated). A "right" bumps the word's total successes and
 * extends its streak; a "wrong" leaves the total alone and resets the streak to
 * 0. Cards absent from `results` are carried over unchanged.
 */
export function applyRoundResults(
  stats: CardStats,
  results: Record<string, StudyResult>,
): CardStats {
  const next: CardStats = { ...stats };
  for (const [cardId, result] of Object.entries(results)) {
    const current = statFor(next, cardId);
    next[cardId] =
      result === "right"
        ? { successes: current.successes + 1, streak: current.streak + 1 }
        : { successes: current.successes, streak: 0 };
  }
  return next;
}

/**
 * A word's quiz weight: how likely it is to be drawn into a streak-weighted
 * quiz. Higher streak → lower weight, so words you keep getting right surface
 * less and the quiz focuses on weaker words. The weight is `1 / (1 + streak)`,
 * which is `1` at streak 0 and asymptotes toward — but never reaches — `0`, so
 * every word keeps a small, non-zero chance of appearing.
 */
export function quizWeight(stat: CardStat): number {
  return 1 / (1 + stat.streak);
}

/**
 * Pick up to `count` distinct cards for a streak-weighted quiz, sampling
 * without replacement with each card weighted by {@link quizWeight}. Weaker
 * words (low streak) show up more, well-known words (high streak) less — but
 * never with zero probability. Fewer than `count` cards returns them all.
 *
 * `random` must behave like {@link Math.random}; it is passed in so callers are
 * explicit and tests can supply a deterministic source.
 */
export function selectQuizDeck(
  cards: Flashcard[],
  stats: CardStats,
  count: number,
  random: () => number,
): Flashcard[] {
  return weightedSampleWithoutReplacement(
    cards,
    (card) => quizWeight(statFor(stats, card.id)),
    count,
    random,
  );
}
