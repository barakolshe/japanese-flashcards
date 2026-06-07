"use client";

import type { RefObject } from "react";

type FlipCardProps = {
  japanese: string;
  english: string;
  /** Whether the meaning (back) is showing. */
  flipped: boolean;
  /** Toggle between the Japanese word and its meaning. */
  onFlip: () => void;
  /** Focus target so the deck can return focus to the card after advancing. */
  buttonRef: RefObject<HTMLButtonElement | null>;
};

/**
 * A single study card that flips on a 3D Y axis: Japanese on the front, the
 * English meaning on the back. The whole card is a button, so Space/Enter flip
 * it when focused. Under reduced-motion the flip snaps (see globals.css).
 */
export function FlipCard({
  japanese,
  english,
  flipped,
  onFlip,
  buttonRef,
}: FlipCardProps) {
  return (
    <div className="[perspective:1400px]">
      <button
        ref={buttonRef}
        type="button"
        onClick={onFlip}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? "Showing the English meaning. Activate to show the Japanese word."
            : "Showing the Japanese word. Activate to reveal the meaning."
        }
        data-flipped={flipped}
        className="relative block h-[19rem] w-full rounded-2xl outline-none transition-transform duration-500 [transform-style:preserve-3d] [transition-timing-function:var(--ease-out-quart)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-[flipped=true]:[transform:rotateY(180deg)] sm:h-[23rem]"
      >
        {/* Front — Japanese */}
        <CardFace
          className="border-border bg-surface"
          label="Japanese"
          hint="Tap or press Space to flip"
        >
          <span
            lang="ja"
            className="font-jp text-balance text-center text-5xl font-medium leading-tight text-ink sm:text-6xl"
          >
            {japanese}
          </span>
        </CardFace>

        {/* Back — English meaning (pre-rotated so its text reads correctly) */}
        <CardFace
          className="border-primary/25 bg-primary/[0.05] [transform:rotateY(180deg)]"
          label="Meaning"
          hint="Tap to flip back"
        >
          <span className="text-balance text-center text-3xl font-semibold leading-snug text-ink sm:text-4xl">
            {english}
          </span>
        </CardFace>
      </button>
    </div>
  );
}

function CardFace({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border px-6 py-8 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${className}`}
    >
      <span className="absolute left-5 top-4 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex flex-1 items-center justify-center">{children}</div>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}
