"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { useJapaneseSpeech } from "@/lib/speech";

/**
 * A reference list of a set of cards. Each row shows the Japanese word and the
 * English meaning side by side, with two controls on the left: a speaker to hear
 * the Japanese word, and an eye that reveals the word's pronunciation (an English
 * romaji reading) beneath it. The pronunciation is hidden by default — each row
 * tracks its own reveal state, so the list reads as a quiz until the learner asks
 * for the reading. Shared by the in-session word-list panel and the standalone
 * collection list screen, so both render identical rows.
 */
export function WordListRows({ cards }: { cards: Flashcard[] }) {
  // One shared speech player for the whole list, with the row whose word is
  // currently playing tracked so only that row shows the active speaker.
  const { supported: canSpeak, speaking, speak, stop: stopSpeech } =
    useJapaneseSpeech();
  const [speakingCardId, setSpeakingCardId] = useState<string | null>(null);
  // Which rows have their pronunciation revealed; everything else stays hidden.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  function toggleSpeak(card: Flashcard) {
    if (speaking && speakingCardId === card.id) {
      stopSpeech();
      return;
    }
    setSpeakingCardId(card.id);
    speak(card.japanese);
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {cards.map((card) => {
        const isSpeaking = speaking && speakingCardId === card.id;
        const hasPronunciation = Boolean(card.pronunciation);
        const isRevealed = revealed.has(card.id);
        return (
          <li
            key={card.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex shrink-0 items-center gap-1">
                {canSpeak ? (
                  <button
                    type="button"
                    onClick={() => toggleSpeak(card)}
                    aria-label={
                      isSpeaking
                        ? "Stop pronunciation"
                        : `Play pronunciation of ${card.japanese}`
                    }
                    title={isSpeaking ? "Stop" : "Hear pronunciation"}
                    data-speaking={isSpeaking}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-bg text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[speaking=true]:border-transparent data-[speaking=true]:bg-primary data-[speaking=true]:text-bg"
                  >
                    <SpeakerIcon speaking={isSpeaking} />
                  </button>
                ) : null}
                {hasPronunciation ? (
                  <button
                    type="button"
                    onClick={() => toggleReveal(card.id)}
                    aria-pressed={isRevealed}
                    aria-label={
                      isRevealed ? "Hide pronunciation" : "Show pronunciation"
                    }
                    title={isRevealed ? "Hide pronunciation" : "Show pronunciation"}
                    data-active={isRevealed}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-bg text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[active=true]:border-transparent data-[active=true]:bg-primary data-[active=true]:text-bg"
                  >
                    <EyeIcon open={isRevealed} />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0">
                <p
                  lang="ja"
                  className="font-jp truncate text-base text-ink"
                  title={card.japanese}
                >
                  {card.japanese}
                </p>
                {hasPronunciation && isRevealed ? (
                  <p
                    className="truncate text-xs italic text-muted"
                    title={card.pronunciation}
                  >
                    {card.pronunciation}
                  </p>
                ) : null}
              </div>
            </div>
            <p
              className="shrink-0 text-right text-sm text-muted"
              title={card.english}
            >
              {card.english}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function SpeakerIcon({ speaking }: { speaking: boolean }) {
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
      <path d="M11 4.7 6.5 8.3H3v7.4h3.5L11 19.3z" />
      {/* The sound waves firm up while the word is playing. */}
      <path d="M16 9a4 4 0 0 1 0 6" opacity={speaking ? 1 : 0.85} />
      <path d="M19 6.5a8 8 0 0 1 0 11" opacity={speaking ? 1 : 0.55} />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {/* A slash falls across the eye while the reading is hidden. */}
      {open ? null : <path d="m4 4 16 16" />}
    </svg>
  );
}

/**
 * A full-screen word list for a chosen collection (or any titled set of cards),
 * launched from the dashboard so the user can review the words without entering
 * a study session.
 */
export function WordListScreen({
  title,
  cards,
  onBack,
}: {
  title: string;
  cards: Flashcard[];
  onBack: () => void;
}) {
  return (
    <section
      aria-label={`Words in ${title}`}
      className="w-full motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]"
    >
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <span aria-hidden className="text-muted/50">
            ·
          </span>
          <p className="text-sm font-medium text-muted">
            {cards.length} word{cards.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to deck
        </button>
      </header>

      <div className="mt-5">
        {cards.length > 0 ? (
          <WordListRows cards={cards} />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
            This collection has no cards yet.
          </p>
        )}
      </div>
    </section>
  );
}
