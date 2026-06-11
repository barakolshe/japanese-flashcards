import {
  createCard,
  DEFAULT_COLLECTION,
  collectionNames,
  type Flashcard,
} from "./flashcards";

/**
 * A folder groups collections together — the directory layer above collections.
 * It holds the names of the collections filed under it, in display order. A
 * collection belongs to at most one folder; collections in no folder are
 * "ungrouped". Folders are an in-app organization aid only and are never written
 * to the exported CSV.
 */
export type Folder = {
  name: string;
  collections: string[];
};

/**
 * A working deck: the loaded cards, the collections the user can sort them into,
 * and the folders those collections are grouped under.
 *
 * Collections are tracked separately from cards so a freshly created collection
 * can exist before any card is moved into it. The list always contains every
 * collection referenced by a card, in first-seen order, followed by any empty
 * collections the user has added. Folders reference collections by name; every
 * name in a folder is also present in `collections`.
 */
export type Deck = {
  cards: Flashcard[];
  collections: string[];
  folders: Folder[];
};

/** Result of a collection or folder operation that can fail validation. */
export type DeckResult =
  | { ok: true; deck: Deck }
  | { ok: false; error: string };

/**
 * Result of duplicating a collection. Carries the generated name of the copy so
 * the caller can focus it, since the name is derived rather than user-supplied.
 */
export type DuplicateResult =
  | { ok: true; deck: Deck; name: string }
  | { ok: false; error: string };

/** Case-insensitive, whitespace-insensitive key for comparing names. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/** Build a fresh deck from a parsed set of cards (no folders yet). */
export function deckFromCards(cards: Flashcard[]): Deck {
  return { cards, collections: collectionNames(cards), folders: [] };
}

/**
 * Append freshly imported cards to an existing deck, keeping the current cards,
 * collections, and folders and adding any new collections the imported cards
 * introduce (in first-seen order, after the existing ones). Existing collections
 * are matched case-insensitively so a re-import doesn't create a near-duplicate.
 */
export function appendCards(deck: Deck, cards: Flashcard[]): Deck {
  const collections = [...deck.collections];
  for (const collection of collectionNames(cards)) {
    if (!collections.some((existing) => key(existing) === key(collection))) {
      collections.push(collection);
    }
  }
  return { ...deck, cards: [...deck.cards, ...cards], collections };
}

/** Number of cards in each collection, keyed by collection name. */
export function collectionCounts(deck: Deck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const collection of deck.collections) counts.set(collection, 0);
  for (const card of deck.cards) {
    counts.set(card.collection, (counts.get(card.collection) ?? 0) + 1);
  }
  return counts;
}

/** Collections that aren't filed under any folder, in `collections` order. */
export function ungroupedCollections(deck: Deck): string[] {
  const filed = new Set<string>();
  for (const folder of deck.folders) {
    for (const collection of folder.collections) filed.add(collection);
  }
  return deck.collections.filter((collection) => !filed.has(collection));
}

/** The folder a collection is filed under, or `null` if it's ungrouped. */
export function folderOfCollection(deck: Deck, collection: string): string | null {
  const folder = deck.folders.find((f) => f.collections.includes(collection));
  return folder ? folder.name : null;
}

/**
 * Add a new, empty collection. Rejects blank names and names that collide with
 * an existing collection (compared case-insensitively, ignoring surrounding
 * space).
 */
export function addCollection(deck: Deck, name: string): DeckResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Collection name can't be empty." };
  }
  if (deck.collections.some((collection) => key(collection) === key(trimmed))) {
    return {
      ok: false,
      error: `A collection named "${trimmed}" already exists.`,
    };
  }
  return {
    ok: true,
    deck: { ...deck, collections: [...deck.collections, trimmed] },
  };
}

/**
 * Rename a collection, moving every card in it to the new name and relabeling
 * any folder it's filed under. Renaming to the same name (modulo case) is
 * allowed and just relabels; renaming onto a different existing collection is
 * rejected rather than silently merging.
 */
export function renameCollection(
  deck: Deck,
  oldName: string,
  newName: string,
): DeckResult {
  const trimmed = newName.trim();
  if (!deck.collections.includes(oldName)) {
    return { ok: false, error: `There's no collection named "${oldName}".` };
  }
  if (!trimmed) {
    return { ok: false, error: "Collection name can't be empty." };
  }
  const collides = deck.collections.some(
    (collection) => collection !== oldName && key(collection) === key(trimmed),
  );
  if (collides) {
    return {
      ok: false,
      error: `A collection named "${trimmed}" already exists.`,
    };
  }
  return {
    ok: true,
    deck: {
      cards: deck.cards.map((card) =>
        card.collection === oldName ? { ...card, collection: trimmed } : card,
      ),
      collections: deck.collections.map((collection) =>
        collection === oldName ? trimmed : collection,
      ),
      folders: deck.folders.map((folder) => ({
        ...folder,
        collections: folder.collections.map((collection) =>
          collection === oldName ? trimmed : collection,
        ),
      })),
    },
  };
}

/**
 * Pick a free name for a copy of `base`, e.g. `Animals copy`, then
 * `Animals copy 2`, `Animals copy 3`, ... skipping any that already exist
 * (compared case-insensitively).
 */
function uniqueCopyName(collections: string[], base: string): string {
  const taken = new Set(collections.map(key));
  const first = `${base} copy`;
  if (!taken.has(key(first))) return first;
  let n = 2;
  while (taken.has(key(`${base} copy ${n}`))) n++;
  return `${base} copy ${n}`;
}

/**
 * Duplicate a collection and every card in it into a new collection named
 * `"<collection> copy"` (deduplicated if that name is taken). The copies are
 * fresh cards with new ids, so editing or moving them never touches the
 * originals. The new collection is inserted right after the source; if the
 * source is filed under a folder, the copy joins that same folder right after
 * it.
 */
export function duplicateCollection(deck: Deck, name: string): DuplicateResult {
  if (!deck.collections.includes(name)) {
    return { ok: false, error: `There's no collection named "${name}".` };
  }
  const newName = uniqueCopyName(deck.collections, name);
  const copies = deck.cards
    .filter((card) => card.collection === name)
    .map((card) => createCard(card.japanese, card.english, newName));

  const collections = [...deck.collections];
  collections.splice(collections.indexOf(name) + 1, 0, newName);

  const folders = deck.folders.map((folder) => {
    const at = folder.collections.indexOf(name);
    if (at === -1) return folder;
    const next = [...folder.collections];
    next.splice(at + 1, 0, newName);
    return { ...folder, collections: next };
  });

  return {
    ok: true,
    deck: { cards: [...deck.cards, ...copies], collections, folders },
    name: newName,
  };
}

/**
 * Add a new card to a collection. Both the Japanese and English text are
 * required; a blank value is rejected. The target collection is created
 * (ungrouped) if it doesn't exist yet, mirroring {@link moveCard}.
 */
export function addCard(
  deck: Deck,
  japanese: string,
  english: string,
  collection: string,
): DeckResult {
  const j = japanese.trim();
  const e = english.trim();
  const missing: string[] = [];
  if (!j) missing.push("Japanese");
  if (!e) missing.push("English");
  if (missing.length > 0) {
    return { ok: false, error: `Add the ${missing.join(" and ")} text first.` };
  }

  const target = collection.trim() || DEFAULT_COLLECTION;
  const collections = deck.collections.some((c) => key(c) === key(target))
    ? deck.collections
    : [...deck.collections, target];
  return {
    ok: true,
    deck: { ...deck, cards: [...deck.cards, createCard(j, e, target)], collections },
  };
}

/**
 * Remove a single card from the deck. Collections and folders are left
 * untouched, so a collection that empties out stays in the list (consistent with
 * how the app keeps empty collections around) until it's deleted explicitly.
 */
export function removeCard(deck: Deck, cardId: string): Deck {
  return {
    ...deck,
    cards: deck.cards.filter((card) => card.id !== cardId),
  };
}

/**
 * Delete a collection. Any cards it holds fall back to
 * {@link DEFAULT_COLLECTION} (which is re-created if those cards have nowhere
 * else to land), and it's removed from any folder it was filed under. Deleting
 * the default collection while it still holds cards is a no-op, since there's no
 * safer home.
 */
export function removeCollection(deck: Deck, name: string): Deck {
  const hasCards = deck.cards.some((card) => card.collection === name);
  if (name === DEFAULT_COLLECTION && hasCards) return deck;

  const cards = deck.cards.map((card) =>
    card.collection === name ? { ...card, collection: DEFAULT_COLLECTION } : card,
  );
  let collections = deck.collections.filter((collection) => collection !== name);
  if (hasCards && !collections.includes(DEFAULT_COLLECTION)) {
    collections = [...collections, DEFAULT_COLLECTION];
  }
  const folders = deck.folders.map((folder) => ({
    ...folder,
    collections: folder.collections.filter((collection) => collection !== name),
  }));
  return { cards, collections, folders };
}

/**
 * Move a single card into a collection. The target collection is added to the
 * list (ungrouped) if it isn't there yet, so moving into a just-typed name works
 * in one step.
 */
export function moveCard(deck: Deck, cardId: string, collection: string): Deck {
  const target = collection.trim();
  const collections = deck.collections.some((c) => key(c) === key(target))
    ? deck.collections
    : [...deck.collections, target];
  return {
    ...deck,
    cards: deck.cards.map((card) =>
      card.id === cardId ? { ...card, collection: target } : card,
    ),
    collections,
  };
}

/**
 * Add a new, empty folder. Rejects blank names and names that collide with an
 * existing folder (compared case-insensitively, ignoring surrounding space).
 */
export function addFolder(deck: Deck, name: string): DeckResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Folder name can't be empty." };
  }
  if (deck.folders.some((folder) => key(folder.name) === key(trimmed))) {
    return { ok: false, error: `A folder named "${trimmed}" already exists.` };
  }
  return {
    ok: true,
    deck: { ...deck, folders: [...deck.folders, { name: trimmed, collections: [] }] },
  };
}

/**
 * Rename a folder. Renaming to the same name (modulo case) just relabels;
 * renaming onto a different existing folder is rejected.
 */
export function renameFolder(
  deck: Deck,
  oldName: string,
  newName: string,
): DeckResult {
  const trimmed = newName.trim();
  if (!deck.folders.some((folder) => folder.name === oldName)) {
    return { ok: false, error: `There's no folder named "${oldName}".` };
  }
  if (!trimmed) {
    return { ok: false, error: "Folder name can't be empty." };
  }
  const collides = deck.folders.some(
    (folder) => folder.name !== oldName && key(folder.name) === key(trimmed),
  );
  if (collides) {
    return { ok: false, error: `A folder named "${trimmed}" already exists.` };
  }
  return {
    ok: true,
    deck: {
      ...deck,
      folders: deck.folders.map((folder) =>
        folder.name === oldName ? { ...folder, name: trimmed } : folder,
      ),
    },
  };
}

/**
 * Delete a folder. Its collections become ungrouped — the collections and their
 * cards are untouched, only the grouping is removed.
 */
export function removeFolder(deck: Deck, name: string): Deck {
  return {
    ...deck,
    folders: deck.folders.filter((folder) => folder.name !== name),
  };
}

/**
 * File a collection under a folder, or ungroup it when `folder` is `null`. A
 * collection lives in at most one folder, so it's first removed from any folder
 * it was in. A non-null folder that doesn't exist is ignored (the collection is
 * left ungrouped) rather than invented.
 */
export function moveCollection(
  deck: Deck,
  collection: string,
  folder: string | null,
): Deck {
  const detached = deck.folders.map((f) => ({
    ...f,
    collections: f.collections.filter((c) => c !== collection),
  }));
  const folders =
    folder === null
      ? detached
      : detached.map((f) =>
          f.name === folder
            ? { ...f, collections: [...f.collections, collection] }
            : f,
        );
  return { ...deck, folders };
}
