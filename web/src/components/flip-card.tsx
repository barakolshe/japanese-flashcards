"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  sideName,
  type CardOrientation,
  type CardSide,
} from "@/lib/study-direction";

type FlipCardProps = {
  japanese: string;
  english: string;
  /**
   * An English reading of the Japanese word. When present, an eye toggle on the
   * Japanese side reveals it above the word; omitted cards show no eye control.
   */
  pronunciation?: string;
  /** Which side is the prompt (front) and which is the reveal (back). */
  orientation: CardOrientation;
  /** Whether the back (answer) is showing. */
  flipped: boolean;
  /** Toggle between the prompt and the answer. */
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
 * A single study card that flips on a 3D Y axis. The prompt sits on a neutral
 * surface; the answer carries the primary tint, whichever language each holds.
 * Study direction decides which side is which (see study-direction.ts). The
 * whole card is a button, so Space/Enter flip it when focused. Under
 * reduced-motion the flip snaps (see globals.css).
 */
export function FlipCard({
  japanese,
  english,
  pronunciation,
  orientation,
  flipped,
  onFlip,
  buttonRef,
  onSpeak,
  speaking = false,
}: FlipCardProps) {
  const frontName = sideName(orientation.front);
  const backName = sideName(orientation.back);
  // The speaker reads the Japanese word, so it belongs on whichever side is
  // currently face-up showing Japanese — front by default, back when the
  // learner reverses the study direction. The eye toggle rides along with it.
  const japaneseFaceUp = (flipped ? orientation.back : orientation.front) === "japanese";

  const hasPronunciation = Boolean(pronunciation);
  const [showPronunciation, setShowPronunciation] = useState(false);
  // Reset the reveal when the card changes so the next word starts hidden. The
  // Japanese text is a reliable per-card key here (cards advance one at a time).
  useEffect(() => {
    setShowPronunciation(false);
  }, [japanese]);

  return (
    <div className="relative [perspective:1400px]">
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
          pronunciation={pronunciation}
          showPronunciation={showPronunciation}
        />

        {/* Back — the answer, primary-tinted and pre-rotated so it reads right. */}
        <CardFace
          position="back"
          side={orientation.back}
          japanese={japanese}
          english={english}
          pronunciation={pronunciation}
          showPronunciation={showPronunciation}
        />
      </button>

      {/*
        The eye and speaker controls are siblings of the card button, not
        children — nesting one button inside another is invalid HTML. They sit in
        the top-right corner and fade out of view (and the tab order) whenever the
        face showing isn't the Japanese one, rather than popping in and out. Both
        act on the Japanese word, so they belong only on its side.
      */}
      {hasPronunciation || onSpeak ? (
        <div
          aria-hidden={!japaneseFaceUp}
          className="absolute right-3 top-3 z-10 flex items-center gap-2 transition-opacity duration-200 ease-[var(--ease-out-quart)] aria-hidden:pointer-events-none aria-hidden:opacity-0"
        >
          {hasPronunciation ? (
            <button
              type="button"
              onClick={() => setShowPronunciation((shown) => !shown)}
              tabIndex={japaneseFaceUp ? 0 : -1}
              aria-pressed={showPronunciation}
              aria-label={
                showPronunciation ? "Hide pronunciation" : "Show pronunciation"
              }
              title={showPronunciation ? "Hide pronunciation" : "Show pronunciation"}
              data-active={showPronunciation}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-bg text-muted transition-[color,background-color,border-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 data-[active=true]:border-transparent data-[active=true]:bg-primary data-[active=true]:text-bg"
            >
              <EyeIcon open={showPronunciation} />
            </button>
          ) : null}

          {onSpeak ? (
            <button
              type="button"
              onClick={onSpeak}
              tabIndex={japaneseFaceUp ? 0 : -1}
              aria-label={
                speaking
                  ? "Stop pronunciation"
                  : `Play pronunciation of ${japanese}`
              }
              title={speaking ? "Stop" : "Hear pronunciation"}
              data-speaking={speaking}
              className="group relative inline-flex size-11 items-center justify-center rounded-full border border-border bg-bg text-muted transition-[color,background-color,border-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 data-[speaking=true]:border-transparent data-[speaking=true]:bg-primary data-[speaking=true]:text-bg"
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
      ) : null}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
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
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {/* A slash falls across the eye while the reading is hidden. */}
      {open ? null : <path d="m4 4 16 16" />}
    </svg>
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
  position,
  side,
  japanese,
  english,
  pronunciation,
  showPronunciation,
}: {
  position: "front" | "back";
  side: CardSide;
  japanese: string;
  english: string;
  pronunciation?: string;
  showPronunciation: boolean;
}) {
  const isFront = position === "front";
  const isJapanese = side === "japanese";

  const surfaceClass = isFront
    ? "border-border bg-surface"
    : "border-primary/25 bg-primary/[0.05] [transform:rotateY(180deg)]";
  const label = isJapanese ? "Japanese" : "Meaning";
  const hint = isFront ? "Tap or press Space to flip" : "Tap to flip back";
  // The reading sits above the Japanese word, and only there — it's a hint for
  // saying that word, meaningless on the meaning side.
  const reading = isJapanese && showPronunciation ? pronunciation : undefined;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border px-6 py-8 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${surfaceClass}`}
    >
      <span className="absolute left-5 top-4 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        {isJapanese ? (
          <>
            {reading ? (
              <span className="text-balance text-center text-lg font-medium tracking-wide text-primary sm:text-xl">
                {reading}
              </span>
            ) : null}
            <span
              lang="ja"
              className="font-jp text-balance text-center text-5xl font-medium leading-tight text-ink sm:text-6xl"
            >
              {japanese}
            </span>
          </>
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
