"use client";

import { folderNames, type Flashcard } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";

const PREVIEW_COUNT = 6;

function folderCounts(cards: Flashcard[]): { folder: string; count: number }[] {
  return folderNames(cards).map((folder) => ({
    folder,
    count: cards.filter((card) => card.folder === folder).length,
  }));
}

export function DeckSummary() {
  const { cards, clear } = useFlashcards();
  const folders = folderCounts(cards);
  const preview = cards.slice(0, PREVIEW_COUNT);
  const remaining = cards.length - preview.length;

  return (
    <div className="w-full motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]">
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-ink">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          {cards.length} card{cards.length > 1 ? "s" : ""} ready
        </h2>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Load a different file
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {folders.map(({ folder, count }) => (
          <span
            key={folder}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm text-ink"
          >
            {folder}
            <span className="text-muted">{count}</span>
          </span>
        ))}
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {preview.map((card) => (
          <li
            key={card.id}
            className="flex items-baseline justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4"
          >
            <span
              lang="ja"
              className="font-jp text-2xl font-medium leading-tight text-ink"
            >
              {card.japanese}
            </span>
            <span className="shrink-0 text-right text-sm text-muted">
              {card.english}
            </span>
          </li>
        ))}
      </ul>

      {remaining > 0 ? (
        <p className="mt-4 text-center text-sm text-muted">
          and {remaining} more card{remaining > 1 ? "s" : ""} in your deck.
        </p>
      ) : null}
    </div>
  );
}
