"use client";

import { useId, useMemo, useRef, useState } from "react";
import { serializeFlashcardsCsv, type Flashcard } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";
import { useCsvImport } from "@/lib/use-csv-import";
import type { CardFront } from "@/lib/study-direction";
import type { Tag } from "@/lib/deck";
import type { StudyTarget } from "./deck-study";
import { ImportNotice } from "./csv-upload";
import { TagDot, tagTint } from "./tags";

type StudySetupProps = {
  /** Which side cards show first. */
  front: CardFront;
  /** Change which side leads. */
  onFrontChange: (front: CardFront) => void;
  /** Begin a session for the chosen target (whole deck, a collection, or a folder). */
  onStart: (target: StudyTarget) => void;
  /** Open the organize screen to sort cards into collections and folders. */
  onOrganize: () => void;
  /** Open the read-only word list for a single collection. */
  onViewList: (collection: string) => void;
};

const EXPORT_FILENAME = "flashcards.csv";

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
  onViewList,
}: StudySetupProps) {
  const { cards, collections, folders, tags, collectionTags, addCards, clear } =
    useFlashcards();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const importer = useCsvImport(addCards);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const collection of collections) map.set(collection, 0);
    for (const card of cards) {
      map.set(card.collection, (map.get(card.collection) ?? 0) + 1);
    }
    return map;
  }, [cards, collections]);

  const filed = useMemo(() => {
    const set = new Set<string>();
    for (const folder of folders) {
      for (const collection of folder.collections) set.add(collection);
    }
    return set;
  }, [folders]);

  const ungrouped = useMemo(
    () => collections.filter((collection) => !filed.has(collection)),
    [collections, filed],
  );

  const hasFocusOptions = folders.length > 0 || collections.length > 1;

  // Tag filtering: a collection is shown when no tag is selected, or when it
  // carries any of the selected tags (OR). Filtering keeps the folder grouping —
  // it only hides the collections (and folders) that don't match.
  const selectedKeys = useMemo(
    () => new Set(selectedTags.map((name) => name.toLowerCase())),
    [selectedTags],
  );
  const isFiltering = selectedTags.length > 0;
  const matches = (collection: string) =>
    !isFiltering ||
    (collectionTags[collection] ?? []).some((name) =>
      selectedKeys.has(name.toLowerCase()),
    );

  const visibleFolders = folders
    .map((folder) => ({ folder, visible: folder.collections.filter(matches) }))
    .filter(({ visible }) => !isFiltering || visible.length > 0);
  const visibleUngrouped = ungrouped.filter(matches);
  const nothingMatches =
    isFiltering && visibleFolders.length === 0 && visibleUngrouped.length === 0;

  // Every collection currently shown (across folders and ungrouped), for the
  // "study all shown" button. No collection appears in two places, so no dupes.
  const visibleCollections = [
    ...visibleFolders.flatMap(({ visible }) => visible),
    ...visibleUngrouped,
  ];
  const visibleCardCount = visibleCollections.reduce(
    (sum, collection) => sum + (counts.get(collection) ?? 0),
    0,
  );

  const toggleTag = (name: string) =>
    setSelectedTags((prev) =>
      prev.some((tag) => tag.toLowerCase() === name.toLowerCase())
        ? prev.filter((tag) => tag.toLowerCase() !== name.toLowerCase())
        : [...prev, name],
    );
  const clearTags = () => setSelectedTags([]);

  return (
    <div className="w-full motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]">
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-ink">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          {cards.length} card{cards.length > 1 ? "s" : ""} ready
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <AddCardsButton importer={importer} />
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
          {confirmingClear ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border border-danger/40 bg-danger/[0.06] px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                Clear saved deck
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Load a different file
            </button>
          )}
        </div>
      </div>

      {confirmingClear ? (
        <p
          role="status"
          className="mt-3 text-right text-sm text-muted motion-safe:animate-[rise_0.16s_var(--ease-out-quart)]"
        >
          This erases the saved deck and your collections and folders. Export
          first if you want to keep it.
        </p>
      ) : null}

      {importer.error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-danger"
        >
          {importer.error}
        </div>
      ) : null}

      {importer.added > 0 ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm font-medium text-ink"
        >
          Added {importer.added} card{importer.added > 1 ? "s" : ""} to your deck.
        </p>
      ) : null}

      <ImportNotice
        skipped={importer.skipped}
        fileErrors={importer.fileErrors}
      />

      <ShowFirstToggle front={front} onFrontChange={onFrontChange} />

      <button
        type="button"
        onClick={() => onStart({ kind: "all" })}
        className="mt-4 w-full rounded-xl bg-primary px-5 py-4 text-lg font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Study all {cards.length} cards
      </button>

      {hasFocusOptions ? (
        <div className="mt-8 space-y-6">
          <h3 className="text-sm font-medium text-muted">
            Or focus on a folder or collection
          </h3>

          {tags.length > 0 ? (
            <TagFilter
              tags={tags}
              selected={selectedTags}
              onToggle={toggleTag}
              onClear={clearTags}
            />
          ) : null}

          {visibleCollections.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                onStart({
                  kind: "collections",
                  names: visibleCollections,
                  title: isFiltering
                    ? `Tagged ${selectedTags.join(", ")}`
                    : "All collections",
                })
              }
              disabled={visibleCardCount === 0}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-left font-medium text-primary transition-colors hover:bg-primary/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60"
            >
              <span>
                {isFiltering
                  ? `Study all ${visibleCardCount} matching cards`
                  : `Study all ${visibleCardCount} cards in collections`}
              </span>
              <span className="shrink-0 text-xs text-primary/80">
                {visibleCollections.length} collection
                {visibleCollections.length === 1 ? "" : "s"}
              </span>
            </button>
          ) : null}

          {nothingMatches ? (
            <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              No collections match the selected tag
              {selectedTags.length === 1 ? "" : "s"}.
            </p>
          ) : (
            <>
              {visibleFolders.map(({ folder, visible }) => (
                <FolderGroup
                  key={folder.name}
                  name={folder.name}
                  collections={visible}
                  counts={counts}
                  onStart={onStart}
                  onViewList={onViewList}
                />
              ))}

              {visibleUngrouped.length > 0 ? (
                <div>
                  {visibleFolders.length > 0 ? (
                    <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted/80">
                      Ungrouped
                    </p>
                  ) : null}
                  <CollectionGrid
                    collections={visibleUngrouped}
                    counts={counts}
                    onStart={onStart}
                    onViewList={onViewList}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One folder in the focus list: a header that studies the collections shown
 * under it, with each collection beneath as its own study target. Under a tag
 * filter, `collections` is the folder's matching subset, so "Study all" studies
 * exactly what's displayed.
 */
function FolderGroup({
  name,
  collections,
  counts,
  onStart,
  onViewList,
}: {
  name: string;
  collections: string[];
  counts: Map<string, number>;
  onStart: (target: StudyTarget) => void;
  onViewList: (collection: string) => void;
}) {
  const total = collections.reduce(
    (sum, collection) => sum + (counts.get(collection) ?? 0),
    0,
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => onStart({ kind: "collections", names: collections, title: name })}
        disabled={total === 0}
        className="group flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60"
      >
        <FolderIcon className="shrink-0 text-muted transition-colors group-hover:text-primary" />
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">
          {name}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {total === 0 ? "Empty" : `Study all ${total}`}
        </span>
      </button>

      {collections.length > 0 ? (
        <div className="mt-2.5 pl-3">
          <CollectionGrid
            collections={collections}
            counts={counts}
            onStart={onStart}
            onViewList={onViewList}
          />
        </div>
      ) : (
        <p className="mt-2 pl-3 text-sm text-muted">No collections yet.</p>
      )}
    </div>
  );
}

/**
 * A responsive grid of collections. Each row has a primary button that starts a
 * single-collection session, plus a compact button that opens that collection's
 * read-only word list.
 */
function CollectionGrid({
  collections,
  counts,
  onStart,
  onViewList,
}: {
  collections: string[];
  counts: Map<string, number>;
  onStart: (target: StudyTarget) => void;
  onViewList: (collection: string) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {collections.map((collection) => (
        <li key={collection} className="flex items-stretch gap-1.5">
          <button
            type="button"
            onClick={() => onStart({ kind: "collection", name: collection })}
            className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="min-w-0 truncate font-medium text-ink">
              {collection}
            </span>
            <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-sm text-muted transition-colors group-hover:text-primary">
              {counts.get(collection) ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onViewList(collection)}
            aria-label={`Show the word list for ${collection}`}
            title="Show word list"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-3 text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ListIcon />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Filter the focus list by tag. Tags are multi-select: each click toggles a tag
 * without clearing the others, and a collection is shown when it carries any
 * selected tag. "All" clears the selection. Each tag carries its color on a dot,
 * and a selected chip tints in that color. The folder grouping is preserved —
 * filtering only hides the collections that don't match.
 */
function TagFilter({
  tags,
  selected,
  onToggle,
  onClear,
}: {
  tags: Tag[];
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const selectedKeys = new Set(selected.map((name) => name.toLowerCase()));
  const noneSelected = selected.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={noneSelected}
        onClick={onClear}
        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          noneSelected
            ? "border-primary bg-primary/[0.08] text-primary"
            : "border-border bg-surface text-ink hover:border-ink/30"
        }`}
      >
        All
      </button>
      {tags.map((tag) => {
        const isActive = selectedKeys.has(tag.name.toLowerCase());
        return (
          <button
            key={tag.name}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(tag.name)}
            style={isActive ? tagTint(tag.color) : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive ? "" : "border-border bg-surface hover:border-ink/30"
            }`}
          >
            <TagDot color={tag.color} />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Imports more CSV files into the existing deck. A button fronting a hidden
 * file input; the surrounding {@link StudySetup} renders the resulting feedback.
 */
function AddCardsButton({
  importer,
}: {
  importer: ReturnType<typeof useCsvImport>;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) void importer.importFiles(files);
    // Allow re-selecting the same file(s) again.
    event.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={onInputChange}
        className="sr-only"
      />
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.03] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
      >
        {importer.isReading ? <SpinnerIcon /> : <PlusIcon />}
        {importer.isReading ? "Reading…" : "Add cards"}
      </label>
    </>
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

function PlusIcon() {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      className="motion-safe:animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
    </svg>
  );
}

function ListIcon() {
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
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
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
