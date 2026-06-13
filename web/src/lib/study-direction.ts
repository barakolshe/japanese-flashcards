/**
 * Study direction: which side of a flashcard the learner sees first.
 *
 * By default the Japanese word is the prompt (Japanese is the hero), and the
 * card flips to reveal the English meaning. Reversing it lets the learner drill
 * recall in the other direction — read the meaning, recall the Japanese.
 */

/** The two faces a card can show. */
export type CardSide = "japanese" | "english";

/** The side shown first (the prompt). */
export type CardFront = CardSide;

export type CardOrientation = {
  /** The side shown before flipping — the prompt. */
  front: CardSide;
  /** The side revealed after flipping — the answer. */
  back: CardSide;
};

const SIDE_NAMES: Record<CardSide, string> = {
  japanese: "Japanese word",
  english: "English meaning",
};

const REVEAL_LABELS: Record<CardSide, string> = {
  japanese: "Show Japanese",
  english: "Show meaning",
};

/** Resolve front/back from the chosen prompt side. */
export function orientationFor(front: CardFront): CardOrientation {
  return front === "japanese"
    ? { front: "japanese", back: "english" }
    : { front: "english", back: "japanese" };
}

/** The other prompt side — used to flip the study direction. */
export function oppositeFront(front: CardFront): CardFront {
  return front === "japanese" ? "english" : "japanese";
}

/** Human-readable name of a side, for accessible labels. */
export function sideName(side: CardSide): string {
  return SIDE_NAMES[side];
}

/** Short verb-first label for the button that reveals the given side. */
export function revealLabel(side: CardSide): string {
  return REVEAL_LABELS[side];
}
