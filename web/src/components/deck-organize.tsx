"use client";

import { useMemo, useRef, useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { DEFAULT_FOLDER } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";

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
  const { cards, folders, moveCard, removeCard } = useFlashcards();
  const [filter, setFilter] = useState<Filter>(ALL);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of folders) map.set(folder, 0);
    for (const card of cards) map.set(card.folder, (map.get(card.folder) ?? 0) + 1);
    return map;
  }, [cards, folders]);

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
        Sort your cards into folders to keep topics and lessons apart.
      </p>

      <FolderBar
        folders={folders}
        counts={counts}
        totalCards={cards.length}
        filter={filter}
        onFilter={setFilter}
        onCreated={(name) => setFilter(name)}
      />

      {activeFolder ? (
        <FolderActions
          folder={activeFolder}
          cardCount={counts.get(activeFolder) ?? 0}
          onRenamed={(name) => setFilter(name)}
          onDuplicated={(name) => setFilter(name)}
          onDeleted={() => setFilter(ALL)}
        />
      ) : null}

      {activeFolder ? <AddCard folder={activeFolder} /> : null}

      <ul className="mt-6 divide-y divide-border border-y border-border">
        {shownCards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            folders={folders}
            onMove={(folder) => moveCard(card.id, folder)}
            onRemove={() => removeCard(card.id)}
          />
        ))}
      </ul>

      {shownCards.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center">
          {activeFolder ? (
            <>
              <p className="text-sm text-muted">
                No cards in{" "}
                <span className="font-medium text-ink">{activeFolder}</span> yet.
                Add one above, or move cards here from another folder.
              </p>
              <button
                type="button"
                onClick={() => setFilter(ALL)}
                className="mt-2 rounded-lg px-2 py-1 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View all cards to move some here
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">
              No cards yet. Pick a folder to add cards to it.
            </p>
          )}
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
  totalCards,
  filter,
  onFilter,
  onCreated,
}: {
  folders: string[];
  counts: Map<string, number>;
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
  onDuplicated,
  onDeleted,
}: {
  folder: string;
  cardCount: number;
  onRenamed: (name: string) => void;
  onDuplicated: (name: string) => void;
  onDeleted: () => void;
}) {
  const { renameFolder, duplicateFolder, removeFolder } = useFlashcards();
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
      <button
        type="button"
        onClick={() => {
          const result = duplicateFolder(folder);
          if (result.ok) onDuplicated(result.name);
        }}
        className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Duplicate
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
 * Add a card to the active folder. The form stays open after a successful add
 * and refocuses the Japanese field, so building up a list is a quick rhythm of
 * type, Enter, type. Existing card text stays read-only elsewhere on this
 * screen; this is the one place new cards are authored by hand.
 */
function AddCard({ folder }: { folder: string }) {
  const { addCard } = useFlashcards();
  const [open, setOpen] = useState(false);
  const [japanese, setJapanese] = useState("");
  const [english, setEnglish] = useState("");
  const [error, setError] = useState<string | null>(null);
  const japaneseRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setJapanese("");
    setEnglish("");
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = addCard(japanese, english, folder);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setJapanese("");
    setEnglish("");
    setError(null);
    japaneseRef.current?.focus();
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <PlusIcon />
          Add card
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      className="mt-3 rounded-xl border border-border bg-surface px-3 py-3"
    >
      <p className="text-sm text-muted">
        New card in <span className="font-medium text-ink">{folder}</span>
      </p>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          ref={japaneseRef}
          type="text"
          lang="ja"
          value={japanese}
          autoFocus
          onChange={(event) => {
            setJapanese(event.target.value);
            setError(null);
          }}
          placeholder="日本語"
          aria-label="Japanese"
          aria-invalid={error !== null}
          className="font-jp min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <input
          type="text"
          value={english}
          onChange={(event) => {
            setEnglish(event.target.value);
            setError(null);
          }}
          placeholder="English meaning"
          aria-label="English meaning"
          aria-invalid={error !== null}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Add card
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Done
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function CardRow({
  card,
  folders,
  onMove,
  onRemove,
}: {
  card: Flashcard;
  folders: string[];
  onMove: (folder: string) => void;
  onRemove: () => void;
}) {
  const selectId = `move-${card.id}`;
  const [confirming, setConfirming] = useState(false);

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

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-muted">Delete?</span>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2 py-1.5 font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
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
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${card.japanese}`}
            className="rounded-lg p-2 text-muted transition-colors hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </li>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
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

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
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
