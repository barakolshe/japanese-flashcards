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
  /**
   * Toggle pronunciation of the Japanese word. When omitted (no speech
   * support), the speaker control is hidden entirely.
   */
  onSpeak?: () => void;
  /** Whether audio is currently playing — drives the speaker's active state. */
  speaking?: boolean;
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
  onSpeak,
  speaking = false,
}: FlipCardProps) {
  return (
    <div className="relative [perspective:1400px]">
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

      {/*
        The speaker is a sibling of the card button, not a child — nesting one
        button inside another is invalid HTML. It overlays the front's top-right
        corner. On flip it fades out (and leaves the tab order) rather than
        popping, since the meaning side has no Japanese to read.
      */}
      {onSpeak ? (
        <button
          type="button"
          onClick={onSpeak}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          aria-label={
            speaking ? "Stop pronunciation" : `Play pronunciation of ${japanese}`
          }
          title={speaking ? "Stop" : "Hear pronunciation"}
          data-speaking={speaking}
          className="group absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-full border border-border bg-bg text-muted transition-[color,background-color,border-color,opacity,transform] duration-200 ease-[var(--ease-out-quart)] hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 data-[speaking=true]:border-transparent data-[speaking=true]:bg-primary data-[speaking=true]:text-bg aria-hidden:pointer-events-none aria-hidden:opacity-0"
        >
          {/* Soft ring that radiates only while audio plays. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-primary/30 opacity-0 group-data-[speaking=true]:motion-safe:[animation:speak-pulse_1.4s_var(--ease-out-quart)_infinite]"
          />
          <SpeakerIcon speaking={speaking} />
        </button>
      ) : null}
    </div>
  );
}

function SpeakerIcon({ speaking }: { speaking: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="relative"
    >
      <path d="M11 4.7 6.5 8.3H3v7.4h3.5L11 19.3z" />
      {/* The sound waves fade in as playback starts. */}
      <path
        d="M16 9a4 4 0 0 1 0 6"
        className="origin-center transition-opacity duration-200"
        opacity={speaking ? 1 : 0.85}
      />
      <path
        d="M19 6.5a8 8 0 0 1 0 11"
        className="origin-center transition-opacity duration-200"
        opacity={speaking ? 1 : 0.55}
      />
    </svg>
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
