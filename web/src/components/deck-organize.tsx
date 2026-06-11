"use client";

import { useMemo, useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { DEFAULT_FOLDER } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";
import {
  DEFAULT_TAG_COLOR,
  nextTagColor,
  TAG_COLORS,
} from "@/lib/tag-colors";
import { TagDot } from "./tags";

type DeckOrganizeProps = {
  /** Return to the deck setup screen. */
  onBack: () => void;
};

/** Sentinel for the "all folders" filter; no real folder can be null. */
const ALL: unique symbol = Symbol("all");
type Filter = string | typeof ALL;

/**
 * The in-app organize screen: create, rename, and delete folders, browse cards
 * by folder, and move any card into a different folder. Organization only — the
 * card's Japanese and English text is read-only here.
 */
export function DeckOrganize({ onBack }: DeckOrganizeProps) {
  const { cards, folders, tags, folderTags, moveCard } = useFlashcards();
  const [filter, setFilter] = useState<Filter>(ALL);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of folders) map.set(folder, 0);
    for (const card of cards) map.set(card.folder, (map.get(card.folder) ?? 0) + 1);
    return map;
  }, [cards, folders]);

  // Map a tag name to its color so chips and dots can paint without a lookup.
  const colorByTag = useMemo(() => {
    const map = new Map<string, string>();
    for (const tag of tags) map.set(tag.name.toLowerCase(), tag.color);
    return map;
  }, [tags]);

  // The colors of each folder's tags, for the dots shown on folder chips.
  const tagDotsByFolder = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const folder of folders) {
      const colors = (folderTags[folder] ?? []).map(
        (name) => colorByTag.get(name.toLowerCase()) ?? DEFAULT_TAG_COLOR,
      );
      if (colors.length > 0) map.set(folder, colors);
    }
    return map;
  }, [folders, folderTags, colorByTag]);

  // A filter can be orphaned when its folder is renamed or deleted underneath
  // it; fall back to "all" so the screen never points at a folder that's gone.
  const activeFolder =
    filter !== ALL && folders.includes(filter) ? filter : null;
  const shownCards = activeFolder
    ? cards.filter((card) => card.folder === activeFolder)
    : cards;

  return (
    <section
      aria-label="Organize cards"
      className="w-full motion-safe:animate-[rise_0.24s_var(--ease-out-quart)]"
    >
      <style>{`@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-2xl font-semibold text-ink">Organize cards</h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to deck
        </button>
      </header>
      <p className="mt-1 text-sm text-muted">
        Sort your cards into folders, then tag folders to group them on the deck
        screen.
      </p>

      <FolderBar
        folders={folders}
        counts={counts}
        tagDotsByFolder={tagDotsByFolder}
        totalCards={cards.length}
        filter={filter}
        onFilter={setFilter}
        onCreated={(name) => setFilter(name)}
      />

      {activeFolder ? (
        <>
          <FolderActions
            folder={activeFolder}
            cardCount={counts.get(activeFolder) ?? 0}
            onRenamed={(name) => setFilter(name)}
            onDeleted={() => setFilter(ALL)}
          />
          <FolderTags folder={activeFolder} colorByTag={colorByTag} />
        </>
      ) : null}

      <ul className="mt-6 divide-y divide-border border-y border-border">
        {shownCards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            folders={folders}
            onMove={(folder) => moveCard(card.id, folder)}
          />
        ))}
      </ul>

      {shownCards.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm text-muted">
            No cards in{" "}
            <span className="font-medium text-ink">{activeFolder}</span> yet.
          </p>
          <button
            type="button"
            onClick={() => setFilter(ALL)}
            className="mt-2 rounded-lg px-2 py-1 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            View all cards to move some here
          </button>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-muted">
          {shownCards.length} card{shownCards.length === 1 ? "" : "s"}
          {activeFolder ? (
            <>
              {" "}
              in <span className="font-medium text-ink">{activeFolder}</span>
            </>
          ) : (
            " across all folders"
          )}
        </p>
      )}
    </section>
  );
}

function FolderBar({
  folders,
  counts,
  tagDotsByFolder,
  totalCards,
  filter,
  onFilter,
  onCreated,
}: {
  folders: string[];
  counts: Map<string, number>;
  tagDotsByFolder: Map<string, string[]>;
  totalCards: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onCreated: (name: string) => void;
}) {
  const { addFolder } = useFlashcards();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = addFolder(name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(name.trim());
    setName("");
    setError(null);
    setAdding(false);
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          label="All"
          count={totalCards}
          active={filter === ALL}
          onClick={() => onFilter(ALL)}
        />
        {folders.map((folder) => (
          <Chip
            key={folder}
            label={folder}
            count={counts.get(folder) ?? 0}
            dots={tagDotsByFolder.get(folder)}
            active={filter === folder}
            onClick={() => onFilter(folder)}
          />
        ))}

        {adding ? null : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PlusIcon />
            New folder
          </button>
        )}
      </div>

      {adding ? (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setAdding(false);
                setName("");
                setError(null);
              }
            }}
            placeholder="Folder name"
            aria-label="New folder name"
            aria-invalid={error !== null}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Add folder
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setName("");
              setError(null);
            }}
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FolderActions({
  folder,
  cardCount,
  onRenamed,
  onDeleted,
}: {
  folder: string;
  cardCount: number;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}) {
  const { renameFolder, removeFolder } = useFlashcards();
  const [mode, setMode] = useState<"idle" | "rename" | "confirm-delete">("idle");
  const [name, setName] = useState(folder);
  const [error, setError] = useState<string | null>(null);

  // Deleting the default folder while it holds cards isn't possible (the cards
  // have nowhere safer to land), so don't offer it.
  const canDelete = !(folder === DEFAULT_FOLDER && cardCount > 0);

  function startRename() {
    setName(folder);
    setError(null);
    setMode("rename");
  }

  function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const result = renameFolder(folder, name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onRenamed(name.trim());
    setMode("idle");
  }

  if (mode === "rename") {
    return (
      <form
        onSubmit={submitRename}
        className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
      >
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMode("idle");
          }}
          aria-label={`Rename the ${folder} folder`}
          aria-invalid={error !== null}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Save name
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </button>
        {error ? (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  if (mode === "confirm-delete") {
    const movesCards = cardCount > 0;
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm">
        <p className="text-ink">
          Delete <span className="font-medium">{folder}</span>?
          {movesCards ? (
            <>
              {" "}
              Its {cardCount} card{cardCount === 1 ? "" : "s"} will move to{" "}
              <span className="font-medium">{DEFAULT_FOLDER}</span>.
            </>
          ) : null}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              removeFolder(folder);
              onDeleted();
            }}
            className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            Delete folder
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded-lg px-2.5 py-1.5 font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-1">
      <span className="text-sm text-muted">
        Folder <span className="font-medium text-ink">{folder}</span>
      </span>
      <span aria-hidden className="mx-1 text-muted/50">
        ·
      </span>
      <button
        type="button"
        onClick={startRename}
        className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Rename
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => setMode("confirm-delete")}
          className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

/**
 * Tag editor for the selected folder: shows the folder's tags as removable
 * chips and an inline form to pin a new or existing one. New tags get a color
 * from the palette; typing a name that matches an existing tag reuses its color,
 * so the swatches step aside. Tags created here surface as a filter on the deck
 * screen.
 */
function FolderTags({
  folder,
  colorByTag,
}: {
  folder: string;
  colorByTag: Map<string, string>;
}) {
  const { tags, folderTags, addFolderTag, removeFolderTag } = useFlashcards();
  const assigned = folderTags[folder] ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_TAG_COLOR);
  const [error, setError] = useState<string | null>(null);

  const colorOf = (tagName: string) =>
    colorByTag.get(tagName.toLowerCase()) ?? DEFAULT_TAG_COLOR;

  // Existing tags not yet on this folder, offered as one-tap chips.
  const suggestions = tags.filter(
    (tag) =>
      !assigned.some((name) => name.toLowerCase() === tag.name.toLowerCase()),
  );

  // A typed name that matches an existing tag will reuse that tag's color.
  const typedMatch = colorByTag.get(name.trim().toLowerCase());

  function openAdd() {
    setName("");
    setColor(nextTagColor(tags.map((tag) => tag.color)));
    setError(null);
    setAdding(true);
  }

  function add(tagName: string, tagColor: string) {
    const result = addFolderTag(folder, tagName, tagColor);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setColor(nextTagColor([...tags.map((tag) => tag.color), tagColor]));
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    add(name, color);
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Tags</span>
        {assigned.length === 0 ? (
          <span className="text-sm text-muted/70">None yet</span>
        ) : (
          assigned.map((tagName) => (
            <span
              key={tagName}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg py-1 pl-2.5 pr-1 text-sm font-medium text-ink"
            >
              <TagDot color={colorOf(tagName)} />
              {tagName}
              <button
                type="button"
                onClick={() => removeFolderTag(folder, tagName)}
                aria-label={`Remove tag ${tagName} from ${folder}`}
                className="rounded-full p-0.5 text-muted transition-colors hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <XIcon />
              </button>
            </span>
          ))
        )}

        {adding ? null : (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PlusIcon />
            Tag
          </button>
        )}
      </div>

      {adding ? (
        <div className="mt-3 border-t border-border pt-3">
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setAdding(false);
                  setName("");
                  setError(null);
                }
              }}
              placeholder="Tag name"
              aria-label={`New tag for ${folder}`}
              aria-invalid={error !== null}
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {typedMatch ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <TagDot color={typedMatch} />
                Existing tag
              </span>
            ) : (
              <ColorSwatches selected={color} onSelect={setColor} />
            )}
            <button
              type="submit"
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Add tag
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setName("");
                setError(null);
              }}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
          </form>

          {suggestions.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Reuse</span>
              {suggestions.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => add(tag.name, tag.color)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-sm font-medium text-ink transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <TagDot color={tag.color} />
                  {tag.name}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Palette swatches for choosing a new tag's color, as an accessible radiogroup. */
function ColorSwatches({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Tag color" className="flex items-center gap-1">
      {TAG_COLORS.map((color) => {
        const isSelected = color.value === selected;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={color.label}
            onClick={() => onSelect(color.value)}
            className={`size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isSelected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{ backgroundColor: color.value }}
          />
        );
      })}
    </div>
  );
}

function CardRow({
  card,
  folders,
  onMove,
}: {
  card: Flashcard;
  folders: string[];
  onMove: (folder: string) => void;
}) {
  const selectId = `move-${card.id}`;
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p
          lang="ja"
          className="font-jp truncate text-lg font-medium text-ink"
          title={card.japanese}
        >
          {card.japanese}
        </p>
        <p className="truncate text-sm text-muted" title={card.english}>
          {card.english}
        </p>
      </div>

      <div className="relative shrink-0">
        <label htmlFor={selectId} className="sr-only">
          Move {card.japanese} to a folder
        </label>
        <select
          id={selectId}
          value={card.folder}
          onChange={(event) => onMove(event.target.value)}
          className="max-w-[9rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm font-medium text-ink transition-colors hover:border-ink/30 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:max-w-[12rem]"
        >
          {folders.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
        <ChevronDownIcon />
      </div>
    </li>
  );
}

function Chip({
  label,
  count,
  dots,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dots?: string[];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-primary bg-primary/[0.08] text-primary"
          : "border-border bg-surface text-ink hover:border-ink/30"
      }`}
    >
      {label}
      {dots && dots.length > 0 ? (
        <span className="flex items-center gap-0.5">
          {dots.map((color, index) => (
            <TagDot key={index} color={color} />
          ))}
        </span>
      ) : null}
      <span
        className={`rounded-full px-1.5 text-xs tabular-nums ${
          active ? "bg-primary/15 text-primary" : "bg-bg text-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function PlusIcon() {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function XIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronDownIcon() {
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
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
