"use client";

import { CsvUpload } from "@/components/csv-upload";
import { DeckStudy } from "@/components/deck-study";
import { useFlashcards } from "@/lib/flashcards-store";

export default function Home() {
  const { hydrated, cards } = useFlashcards();
  const hasDeck = cards.length > 0;

  return (
    <div className="min-h-screen px-6 py-16 sm:py-24">
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <header className="text-center">
          <p className="font-jp text-sm font-medium tracking-wide text-primary">
            単語帳
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Japanese Flashcards
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-muted">
            {!hydrated
              ? "Loading your saved deck…"
              : hasDeck
                ? "Pick a folder or the whole deck, then flip through your cards."
                : "Upload a CSV of your words to build a deck of flip-and-shuffle flashcards."}
          </p>
        </header>

        <section className="mt-12 w-full">
          {/* Until the saved deck is restored, show a calm placeholder rather
              than flashing the upload screen and then swapping it out. */}
          {!hydrated ? <DeckSkeleton /> : hasDeck ? <DeckStudy /> : <CsvUpload />}
        </section>
      </main>
    </div>
  );
}

/** Neutral, fixed-height stand-in shown while the saved deck is being read. */
function DeckSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your saved deck"
      className="h-56 w-full rounded-2xl border border-border bg-surface/60 motion-safe:animate-pulse"
    />
  );
}
