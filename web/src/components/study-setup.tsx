"use client";

import { folderNames, type Flashcard } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";

type StudySetupProps = {
  /** Begin a session: `null` studies the whole deck, a string studies one folder. */
  onStart: (folder: string | null) => void;
};

function folderCounts(cards: Flashcard[]): { folder: string; count: number }[] {
  return folderNames(cards).map((folder) => ({
    folder,
    count: cards.filter((card) => card.folder === folder).length,
  }));
}

export function StudySetup({ onStart }: StudySetupProps) {
  const { cards, clear } = useFlashcards();
  const folders = folderCounts(cards);
  const hasFolderChoice = folders.length > 1;

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

      <button
        type="button"
        onClick={() => onStart(null)}
        className="mt-6 w-full rounded-xl bg-primary px-5 py-4 text-lg font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Study all {cards.length} cards
      </button>

      {hasFolderChoice ? (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted">Or focus on a folder</h3>
          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {folders.map(({ folder, count }) => (
              <li key={folder}>
                <button
                  type="button"
                  onClick={() => onStart(folder)}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="font-medium text-ink">{folder}</span>
                  <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-sm text-muted transition-colors group-hover:text-primary">
                    {count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
