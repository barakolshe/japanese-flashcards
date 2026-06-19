import type { StudyResult } from "./study";

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
