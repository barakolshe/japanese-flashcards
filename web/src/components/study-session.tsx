"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { shuffle, type StudyResult } from "@/lib/study";
import { useJapaneseSpeech } from "@/lib/speech";
import {
  oppositeFront,
  orientationFor,
  revealLabel,
  sideName,
  type CardFront,
} from "@/lib/study-direction";
import { FlipCard } from "./flip-card";
import { WordListRows } from "./word-list";

type StudySessionProps = {
  /** The cards to study this session (already narrowed to the chosen target). */
  deck: Flashcard[];
  /** Human label for what's being studied — a collection or folder name, or "All cards". */
  title: string;
  /** Which side leads (the prompt). The reveal is the other side. */
  front: CardFront;
  /** Flip which side leads mid-session; persisted so it sticks for next time. */
  onFrontChange: (front: CardFront) => void;
  /**
   * Record this run's results when the round finishes, so each word's total
   * successes and current streak are saved. Called once, with the final result
   * for every card in the round.
   */
  onRoundComplete: (results: Record<string, StudyResult>) => void;
  /** Leave the session and return to the deck setup screen. */
  onExit: () => void;
};

export function StudySession({
  deck,
  title,
  front,
  onFrontChange,
  onRoundComplete,
  onExit,
}: StudySessionProps) {
  // `pool` is the set being drilled (the full deck, or the cards missed in a
  // previous round). `order` is the current ordering of that pool.
  const [pool, setPool] = useState<Flashcard[]>(deck);
  const [order, setOrder] = useState<Flashcard[]>(deck);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, StudyResult>>({});
  const [done, setDone] = useState(false);
  // Whether the reference list of this round's words is expanded at the bottom.
  const [showList, setShowList] = useState(false);

  const cardRef = useRef<HTMLButtonElement | null>(null);
  const {
    supported: canSpeak,
    speaking,
    unavailable: speechUnavailable,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useJapaneseSpeech();

  const orientation = orientationFor(front);
  const total = order.length;
  const current = order[index];
  const rightCount = useMemo(
    () => Object.values(results).filter((r) => r === "right").length,
    [results],
  );
  const wrongCount = useMemo(
    () => Object.values(results).filter((r) => r === "wrong").length,
    [results],
  );

  // Return focus to the card as it changes so keyboard study keeps flowing.
  useEffect(() => {
    if (!done) cardRef.current?.focus();
  }, [index, done]);

  // Stop any audio when the visible card changes — the old word shouldn't keep
  // playing over the new one.
  useEffect(() => {
    stopSpeech();
  }, [index, stopSpeech]);

  function startRound(nextPool: Flashcard[], doShuffle: boolean) {
    setPool(nextPool);
    setOrder(doShuffle ? shuffle(nextPool, Math.random) : nextPool);
    setIndex(0);
    setFlipped(false);
    setResults({});
    setDone(false);
  }

  function mark(result: StudyResult) {
    const nextResults = { ...results, [current.id]: result };
    setResults(nextResults);
    if (index + 1 < total) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      setDone(true);
      // The round is finished — persist each word's success count and streak.
      // Using the computed results (not the async state) so the last card's
      // mark is included.
      onRoundComplete(nextResults);
    }
  }

  function goPrevious() {
    if (index === 0) return;
    setIndex(index - 1);
    setFlipped(false);
  }

  // Swap which side leads, without disturbing the deck or progress. Land back on
  // the prompt so the new leading side is what the learner sees.
  function flipDirection() {
    onFrontChange(oppositeFront(front));
    setFlipped(false);
  }

  if (done) {
    const missed = order.filter((card) => results[card.id] === "wrong");
    return (
      <ResultsScreen
        title={title}
        rightCount={rightCount}
        total={total}
        missedCount={missed.length}
        onStudyAgain={() => startRound(pool, true)}
        onPracticeMissed={() => startRound(missed, true)}
        onExit={onExit}
      />
    );
  }

  return (
    <section
      aria-label={`Studying ${title}`}
      className="w-full motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]"
    >
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium text-muted">{title}</h2>
          <span aria-hidden className="text-muted/50">
            ·
          </span>
          <p aria-live="polite" className="text-sm font-medium text-ink">
            Card {index + 1} of {total}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <DirectionToggle front={front} onFlip={flipDirection} />
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Back to deck
          </button>
        </div>
      </header>

      <Progress index={index} total={total} />

      <Tally rightCount={rightCount} wrongCount={wrongCount} />

      <div className="mt-5">
        <FlipCard
          // Remount per card so advancing never animates the flip back to the
          // prompt: a fresh element mounts already face-up at rotateY(0) with no
          // transition, instead of spinning 180°→0° and flashing the next card's
          // answer (the side not meant to be seen yet) mid-rotation.
          key={current.id}
          japanese={current.japanese}
          english={current.english}
          pronunciation={current.pronunciation}
          orientation={orientation}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          buttonRef={cardRef}
          onSpeak={canSpeak ? () => toggleSpeech(current.japanese) : undefined}
          speaking={speaking}
        />
      </div>

      {/*
        The speaker uses the browser's built-in voices. Brave's fingerprinting
        shield empties or farbles the voice list, and Windows ships no Japanese
        voice unless its language pack is installed — either way playback is
        silent. Explain it the moment a tap produces no sound, rather than
        leaving a dead button.
      */}
      {speechUnavailable ? (
        <p
          role="status"
          className="mt-3 text-center text-sm text-muted motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]"
        >
          No Japanese voice is available, so playback was silent. In Brave, lower
          Shields&rsquo; fingerprinting blocking for this site; on Windows,
          install a Japanese language voice.
        </p>
      ) : null}

      <div className="mt-5 min-h-12">
        {flipped ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => mark("wrong")}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-semibold text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Missed it
            </button>
            <button
              type="button"
              onClick={() => mark("right")}
              className="rounded-xl bg-primary px-4 py-3 text-base font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Got it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="w-full rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-base font-semibold text-primary transition-colors hover:bg-primary/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {revealLabel(orientation.back)}
          </button>
        )}
      </div>

      <footer className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeftIcon />
          Previous
        </button>
        <button
          type="button"
          onClick={() => startRound(pool, true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ShuffleIcon />
          Shuffle
        </button>
      </footer>

      <WordList
        cards={pool}
        open={showList}
        onToggle={() => setShowList((s) => !s)}
      />
    </section>
  );
}

/**
 * Flips the study direction mid-session. The label reads as the current flow
 * (leading side → reveal side) with the little script glyphs (あ / A), and the
 * accessible name spells out what tapping does.
 */
function DirectionToggle({
  front,
  onFlip,
}: {
  front: CardFront;
  onFlip: () => void;
}) {
  const lead = front;
  const reveal = oppositeFront(front);
  const glyph = (side: CardFront) => (side === "japanese" ? "あ" : "A");
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={`Show ${sideName(reveal)} first instead`}
      title="Switch which side shows first"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <SwapIcon />
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="font-jp leading-none">
          {glyph(lead)}
        </span>
        <span aria-hidden className="text-muted/60">
          →
        </span>
        <span aria-hidden className="font-jp leading-none">
          {glyph(reveal)}
        </span>
      </span>
    </button>
  );
}

function WordList({
  cards,
  open,
  onToggle,
}: {
  cards: Flashcard[];
  open: boolean;
  onToggle: () => void;
}) {
  const listId = "study-word-list";
  return (
    <div className="mt-8 border-t border-border pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ChevronIcon open={open} />
        {open ? "Hide word list" : "Show word list"}
        <span className="text-muted/60">({cards.length})</span>
      </button>

      {open ? (
        <div id={listId} className="mt-3">
          <WordListRows cards={cards} />
        </div>
      ) : null}
    </div>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  // Fraction of the round completed by position (1-based current card).
  const pct = total === 0 ? 0 : ((index + 1) / total) * 100;
  return (
    <div
      className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={index + 1}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Tally({
  rightCount,
  wrongCount,
}: {
  rightCount: number;
  wrongCount: number;
}) {
  return (
    <div className="mt-4 flex items-center gap-4 text-sm text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-accent" />
        {rightCount} right
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-border" />
        {wrongCount} missed
      </span>
    </div>
  );
}

function ResultsScreen({
  title,
  rightCount,
  total,
  missedCount,
  onStudyAgain,
  onPracticeMissed,
  onExit,
}: {
  title: string;
  rightCount: number;
  total: number;
  missedCount: number;
  onStudyAgain: () => void;
  onPracticeMissed: () => void;
  onExit: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((rightCount / total) * 100);
  const message =
    pct === 100
      ? "Perfect round."
      : pct >= 80
        ? "Strong round."
        : pct >= 50
          ? "Getting there."
          : "Keep at it.";

  return (
    <section
      aria-label="Round complete"
      className="w-full text-center motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]"
    >
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="mt-3 text-6xl font-semibold tracking-tight text-ink">
        {rightCount}
        <span className="text-muted">/{total}</span>
      </p>
      <p className="mt-2 text-muted">
        {message} You got {pct}% right.
      </p>

      <div className="mx-auto mt-8 flex max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={onStudyAgain}
          className="rounded-xl bg-primary px-4 py-3 text-base font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Shuffle &amp; study again
        </button>
        {missedCount > 0 ? (
          <button
            type="button"
            onClick={onPracticeMissed}
            className="rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-base font-semibold text-primary transition-colors hover:bg-primary/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Practice the {missedCount} you missed
          </button>
        ) : null}
        <button
          type="button"
          onClick={onExit}
          className="rounded-xl px-4 py-3 text-base font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to deck
        </button>
      </div>
    </section>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}
