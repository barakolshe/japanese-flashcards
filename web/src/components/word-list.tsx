"use client";

import type { Flashcard } from "@/lib/flashcards";

/**
 * A reference list of a set of cards — each row shows the Japanese word (with its
 * optional pronunciation beneath) and the English meaning side by side. Shared by
 * the in-session word-list panel and the standalone collection list screen, so
 * both render identical rows.
 */
export function WordListRows({ cards }: { cards: Flashcard[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {cards.map((card) => (
        <li
          key={card.id}
          className="flex items-baseline justify-between gap-4 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-base text-ink" title={card.japanese}>
              {card.japanese}
            </p>
            {card.pronunciation ? (
              <p
                className="truncate text-xs italic text-muted"
                title={card.pronunciation}
              >
                {card.pronunciation}
              </p>
            ) : null}
          </div>
          <p
            className="shrink-0 text-right text-sm text-muted"
            title={card.english}
          >
            {card.english}
          </p>
        </li>
      ))}
    </ul>
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
