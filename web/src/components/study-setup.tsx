"use client";

import {
  folderNames,
  serializeFlashcardsCsv,
  type Flashcard,
} from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";
import type { CardFront } from "@/lib/study-direction";

type StudySetupProps = {
  /** Which side cards show first. */
  front: CardFront;
  /** Change which side leads. */
  onFrontChange: (front: CardFront) => void;
  /** Begin a session: `null` studies the whole deck, a string studies one folder. */
  onStart: (folder: string | null) => void;
  /** Open the organize screen to sort cards into folders. */
  onOrganize: () => void;
};

const EXPORT_FILENAME = "flashcards.csv";

function folderCounts(cards: Flashcard[]): { folder: string; count: number }[] {
  return folderNames(cards).map((folder) => ({
    folder,
    count: cards.filter((card) => card.folder === folder).length,
  }));
}

/**
 * Download the deck as a CSV file. A leading BOM keeps the Japanese readable
 * when the file is opened in Excel; PapaParse strips it again on re-upload.
 */
function downloadDeckCsv(cards: Flashcard[]) {
  const csv = serializeFlashcardsCsv(cards);
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = EXPORT_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function StudySetup({
  front,
  onFrontChange,
  onStart,
  onOrganize,
}: StudySetupProps) {
  const { cards, clear } = useFlashcards();
  const folders = folderCounts(cards);
  const hasFolderChoice = folders.length > 1;

  return (
    <div className="w-full motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]">
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-ink">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          {cards.length} card{cards.length > 1 ? "s" : ""} ready
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            onClick={onOrganize}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <FolderIcon />
            Organize
          </button>
          <button
            type="button"
            onClick={() => downloadDeckCsv(cards)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <DownloadIcon />
            Export CSV
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Load a different file
          </button>
        </div>
      </div>

      <ShowFirstToggle front={front} onFrontChange={onFrontChange} />

      <button
        type="button"
        onClick={() => onStart(null)}
        className="mt-4 w-full rounded-xl bg-primary px-5 py-4 text-lg font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

/**
 * Pick which side leads. A segmented control over native radios, so arrow keys,
 * focus, and screen readers work without reinventing the affordance. The little
 * script glyph (あ / A) names each side at a glance.
 */
function ShowFirstToggle({
  front,
  onFrontChange,
}: {
  front: CardFront;
  onFrontChange: (front: CardFront) => void;
}) {
  return (
    <fieldset className="mt-7">
      <legend className="text-sm font-medium text-muted">Show first</legend>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
        <FrontOption
          value="japanese"
          glyph="あ"
          label="Japanese"
          current={front}
          onChange={onFrontChange}
        />
        <FrontOption
          value="english"
          glyph="A"
          label="English"
          current={front}
          onChange={onFrontChange}
        />
      </div>
    </fieldset>
  );
}

function FrontOption({
  value,
  glyph,
  label,
  current,
  onChange,
}: {
  value: CardFront;
  glyph: string;
  label: string;
  current: CardFront;
  onChange: (front: CardFront) => void;
}) {
  const selected = current === value;
  return (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        selected ? "bg-primary text-bg" : "text-muted hover:text-ink"
      }`}
    >
      <input
        type="radio"
        name="card-front"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className="font-jp text-base leading-none opacity-80"
      >
        {glyph}
      </span>
      {label}
    </label>
  );
}

function FolderIcon() {
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
      <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
    </svg>
  );
}

function DownloadIcon() {
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
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}
