"use client";

import type { RefObject } from "react";
import {
  sideName,
  type CardOrientation,
  type CardSide,
} from "@/lib/study-direction";

type FlipCardProps = {
  japanese: string;
  english: string;
  /** Which side is the prompt (front) and which is the reveal (back). */
  orientation: CardOrientation;
  /** Whether the back (answer) is showing. */
  flipped: boolean;
  /** Toggle between the prompt and the answer. */
  onFlip: () => void;
  /** Focus target so the deck can return focus to the card after advancing. */
  buttonRef: RefObject<HTMLButtonElement | null>;
};

/**
 * A single study card that flips on a 3D Y axis. The prompt sits on a neutral
 * surface; the answer carries the primary tint, whichever language each holds.
 * Study direction decides which side is which (see study-direction.ts). The
 * whole card is a button, so Space/Enter flip it when focused. Under
 * reduced-motion the flip snaps (see globals.css).
 */
export function FlipCard({
  japanese,
  english,
  orientation,
  flipped,
  onFlip,
  buttonRef,
}: FlipCardProps) {
  const frontName = sideName(orientation.front);
  const backName = sideName(orientation.back);

  return (
    <div className="[perspective:1400px]">
      <button
        ref={buttonRef}
        type="button"
        onClick={onFlip}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? `Showing the ${backName}. Activate to show the ${frontName}.`
            : `Showing the ${frontName}. Activate to reveal the ${backName}.`
        }
        data-flipped={flipped}
        className="relative block h-[19rem] w-full rounded-2xl outline-none transition-transform duration-500 [transform-style:preserve-3d] [transition-timing-function:var(--ease-out-quart)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-[flipped=true]:[transform:rotateY(180deg)] sm:h-[23rem]"
      >
        {/* Front — the prompt, on a calm neutral surface. */}
        <CardFace
          position="front"
          side={orientation.front}
          japanese={japanese}
          english={english}
        />

        {/* Back — the answer, primary-tinted and pre-rotated so it reads right. */}
        <CardFace
          position="back"
          side={orientation.back}
          japanese={japanese}
          english={english}
        />
      </button>
    </div>
  );
}

function CardFace({
  position,
  side,
  japanese,
  english,
}: {
  position: "front" | "back";
  side: CardSide;
  japanese: string;
  english: string;
}) {
  const isFront = position === "front";
  const isJapanese = side === "japanese";

  const surfaceClass = isFront
    ? "border-border bg-surface"
    : "border-primary/25 bg-primary/[0.05] [transform:rotateY(180deg)]";
  const label = isJapanese ? "Japanese" : "Meaning";
  const hint = isFront ? "Tap or press Space to flip" : "Tap to flip back";

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border px-6 py-8 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${surfaceClass}`}
    >
      <span className="absolute left-5 top-4 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex flex-1 items-center justify-center">
        {isJapanese ? (
          <span
            lang="ja"
            className="font-jp text-balance text-center text-5xl font-medium leading-tight text-ink sm:text-6xl"
          >
            {japanese}
          </span>
        ) : (
          <span className="text-balance text-center text-3xl font-semibold leading-snug text-ink sm:text-4xl">
            {english}
          </span>
        )}
      </div>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}
