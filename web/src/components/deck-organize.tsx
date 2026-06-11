"use client";

import { useMemo, useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { DEFAULT_COLLECTION } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";

type DeckOrganizeProps = {
  /** Return to the deck setup screen. */
  onBack: () => void;
};

/** Sentinel for the "all collections" filter; no real collection can be null. */
const ALL: unique symbol = Symbol("all");
type Filter = string | typeof ALL;

/** Folder-select value standing for "not in any folder". No folder is named "". */
const NO_FOLDER = "";

/**
 * The in-app organize screen. Two jobs, two panels: group collections into
 * folders (the directory layer), and sort cards into collections. Organization
 * only — the card's Japanese and English text is read-only here.
 */
export function DeckOrganize({ onBack }: DeckOrganizeProps) {
  const { cards, collections, folders, moveCard } = useFlashcards();
  const [filter, setFilter] = useState<Filter>(ALL);

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

  // A filter can be orphaned when its collection is renamed or deleted underneath
  // it; fall back to "all" so the screen never points at a collection that's gone.
  const activeCollection =
    filter !== ALL && collections.includes(filter) ? filter : null;
  const shownCards = activeCollection
    ? cards.filter((card) => card.collection === activeCollection)
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
        Sort cards into collections, then group collections into folders to keep
        topics and lessons together.
      </p>

      <FoldersPanel
        collections={collections}
        ungrouped={ungrouped}
        counts={counts}
      />

      <div className="mt-10 border-t border-border pt-8">
        <h3 className="text-lg font-semibold text-ink">Cards</h3>
        <p className="mt-1 text-sm text-muted">
          Browse by collection and move any card into another one.
        </p>

        <CollectionBar
          collections={collections}
          counts={counts}
          totalCards={cards.length}
          filter={filter}
          onFilter={setFilter}
          onCreated={(name) => setFilter(name)}
        />

        {activeCollection ? (
          <CollectionActions
            collection={activeCollection}
            cardCount={counts.get(activeCollection) ?? 0}
            onRenamed={(name) => setFilter(name)}
            onDeleted={() => setFilter(ALL)}
          />
        ) : null}

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {shownCards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              collections={collections}
              onMove={(collection) => moveCard(card.id, collection)}
            />
          ))}
        </ul>

        {shownCards.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center">
            <p className="text-sm text-muted">
              No cards in{" "}
              <span className="font-medium text-ink">{activeCollection}</span>{" "}
              yet.
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
            {activeCollection ? (
              <>
                {" "}
                in{" "}
                <span className="font-medium text-ink">{activeCollection}</span>
              </>
            ) : (
              " across all collections"
            )}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * The folder (directory) panel: create folders, rename and delete them, and file
 * each collection under a folder. Deleting a folder only ungroups its
 * collections — the collections and their cards stay put.
 */
function FoldersPanel({
  collections,
  ungrouped,
  counts,
}: {
  collections: string[];
  ungrouped: string[];
  counts: Map<string, number>;
}) {
  const { folders, addFolder } = useFlashcards();
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
    setName("");
    setError(null);
    setAdding(false);
  }

  const folderNames = folders.map((folder) => folder.name);
  const hasCollections = collections.length > 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-lg font-semibold text-ink">Folders</h3>
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

      {!hasCollections ? (
        <p className="mt-4 text-sm text-muted">
          Add some cards first — then you can sort them into collections and file
          those collections here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.name}
              name={folder.name}
              members={folder.collections}
              counts={counts}
              folderNames={folderNames}
            />
          ))}

          <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
            <p className="text-sm font-medium text-ink">
              Ungrouped
              <span className="ml-1.5 text-muted">({ungrouped.length})</span>
            </p>
            {ungrouped.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {ungrouped.map((collection) => (
                  <CollectionAssignRow
                    key={collection}
                    collection={collection}
                    cardCount={counts.get(collection) ?? 0}
                    current={NO_FOLDER}
                    folderNames={folderNames}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Every collection is filed in a folder.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One folder: its name with rename/delete, and the collections filed under it. */
function FolderCard({
  name,
  members,
  counts,
  folderNames,
}: {
  name: string;
  members: string[];
  counts: Map<string, number>;
  folderNames: string[];
}) {
  const { renameFolder, removeFolder } = useFlashcards();
  const [mode, setMode] = useState<"idle" | "rename" | "confirm-delete">("idle");
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);

  function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const result = renameFolder(name, draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("idle");
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      {mode === "rename" ? (
        <form onSubmit={submitRename} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft}
            autoFocus
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMode("idle");
            }}
            aria-label={`Rename the ${name} folder`}
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
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="flex items-center gap-2 font-medium text-ink">
            <FolderIcon className="text-muted" />
            {name}
            <span className="text-sm font-normal text-muted">
              {members.length} collection{members.length === 1 ? "" : "s"}
            </span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(name);
                setError(null);
                setMode("rename");
              }}
              className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => setMode("confirm-delete")}
              className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {mode === "confirm-delete" ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-sm">
          <p className="text-ink">
            Delete the <span className="font-medium">{name}</span> folder? Its
            collections move back to Ungrouped; no cards are lost.
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => removeFolder(name)}
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
      ) : null}

      {mode !== "rename" ? (
        members.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {members.map((collection) => (
              <CollectionAssignRow
                key={collection}
                collection={collection}
                cardCount={counts.get(collection) ?? 0}
                current={name}
                folderNames={folderNames}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No collections yet. Use a collection&rsquo;s folder menu to file it
            here.
          </p>
        )
      ) : null}
    </div>
  );
}

/** A collection inside the folders panel, with a menu to file it under a folder. */
function CollectionAssignRow({
  collection,
  cardCount,
  current,
  folderNames,
}: {
  collection: string;
  cardCount: number;
  current: string;
  folderNames: string[];
}) {
  const { moveCollection } = useFlashcards();
  const selectId = `folder-${collection}`;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-2">
      <span className="min-w-0 truncate text-sm font-medium text-ink">
        {collection}
        <span className="ml-1.5 font-normal text-muted">{cardCount}</span>
      </span>
      <div className="relative shrink-0">
        <label htmlFor={selectId} className="sr-only">
          Move {collection} to a folder
        </label>
        <select
          id={selectId}
          value={current}
          onChange={(event) =>
            moveCollection(
              collection,
              event.target.value === NO_FOLDER ? null : event.target.value,
            )
          }
          className="max-w-[10rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-sm font-medium text-ink transition-colors hover:border-ink/30 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <option value={NO_FOLDER}>No folder</option>
          {folderNames.map((folder) => (
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

function CollectionBar({
  collections,
  counts,
  totalCards,
  filter,
  onFilter,
  onCreated,
}: {
  collections: string[];
  counts: Map<string, number>;
  totalCards: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onCreated: (name: string) => void;
}) {
  const { addCollection } = useFlashcards();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = addCollection(name);
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
        {collections.map((collection) => (
          <Chip
            key={collection}
            label={collection}
            count={counts.get(collection) ?? 0}
            active={filter === collection}
            onClick={() => onFilter(collection)}
          />
        ))}

        {adding ? null : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PlusIcon />
            New collection
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
            placeholder="Collection name"
            aria-label="New collection name"
            aria-invalid={error !== null}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Add collection
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

function CollectionActions({
  collection,
  cardCount,
  onRenamed,
  onDeleted,
}: {
  collection: string;
  cardCount: number;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}) {
  const { renameCollection, removeCollection } = useFlashcards();
  const [mode, setMode] = useState<"idle" | "rename" | "confirm-delete">("idle");
  const [name, setName] = useState(collection);
  const [error, setError] = useState<string | null>(null);

  // Deleting the default collection while it holds cards isn't possible (the
  // cards have nowhere safer to land), so don't offer it.
  const canDelete = !(collection === DEFAULT_COLLECTION && cardCount > 0);

  function startRename() {
    setName(collection);
    setError(null);
    setMode("rename");
  }

  function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const result = renameCollection(collection, name);
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
          aria-label={`Rename the ${collection} collection`}
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
          Delete <span className="font-medium">{collection}</span>?
          {movesCards ? (
            <>
              {" "}
              Its {cardCount} card{cardCount === 1 ? "" : "s"} will move to{" "}
              <span className="font-medium">{DEFAULT_COLLECTION}</span>.
            </>
          ) : null}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              removeCollection(collection);
              onDeleted();
            }}
            className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            Delete collection
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
        Collection <span className="font-medium text-ink">{collection}</span>
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

function CardRow({
  card,
  collections,
  onMove,
}: {
  card: Flashcard;
  collections: string[];
  onMove: (collection: string) => void;
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
          Move {card.japanese} to a collection
        </label>
        <select
          id={selectId}
          value={card.collection}
          onChange={(event) => onMove(event.target.value)}
          className="max-w-[9rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm font-medium text-ink transition-colors hover:border-ink/30 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:max-w-[12rem]"
        >
          {collections.map((collection) => (
            <option key={collection} value={collection}>
              {collection}
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
