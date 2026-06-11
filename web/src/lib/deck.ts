import {
  createCard,
  DEFAULT_FOLDER,
  folderNames,
  type Flashcard,
} from "./flashcards";

/**
 * A working deck: the loaded cards plus the list of folders the user can sort
 * them into. Folders are tracked separately from cards so a freshly created
 * folder can exist before any card is moved into it — an empty folder would
 * otherwise have nothing to anchor it. The list always contains every folder
 * referenced by a card, in first-seen order, followed by any empty folders the
 * user has added.
 */
export type Deck = {
  cards: Flashcard[];
  folders: string[];
};

/** Result of a folder operation that can fail validation. */
export type DeckResult =
  | { ok: true; deck: Deck }
  | { ok: false; error: string };

/**
 * Result of duplicating a folder. Carries the generated name of the copy so the
 * caller can focus it, since the name is derived rather than user-supplied.
 */
export type DuplicateResult =
  | { ok: true; deck: Deck; name: string }
  | { ok: false; error: string };

/** Case-insensitive, whitespace-insensitive key for comparing folder names. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/** Build a fresh deck from a parsed set of cards. */
export function deckFromCards(cards: Flashcard[]): Deck {
  return { cards, folders: folderNames(cards) };
}

/**
 * Append freshly imported cards to an existing deck, keeping the current cards
 * and folders and adding any new folders the imported cards introduce (in
 * first-seen order, after the existing ones). Existing folders are matched
 * case-insensitively so a re-import doesn't create a near-duplicate folder.
 */
export function appendCards(deck: Deck, cards: Flashcard[]): Deck {
  const folders = [...deck.folders];
  for (const folder of folderNames(cards)) {
    if (!folders.some((existing) => key(existing) === key(folder))) {
      folders.push(folder);
    }
  }
  return { cards: [...deck.cards, ...cards], folders };
}

/** Number of cards in each folder, keyed by folder name. */
export function folderCounts(deck: Deck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const folder of deck.folders) counts.set(folder, 0);
  for (const card of deck.cards) {
    counts.set(card.folder, (counts.get(card.folder) ?? 0) + 1);
  }
  return counts;
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
  if (deck.folders.some((folder) => key(folder) === key(trimmed))) {
    return { ok: false, error: `A folder named "${trimmed}" already exists.` };
  }
  return { ok: true, deck: { ...deck, folders: [...deck.folders, trimmed] } };
}

/**
 * Rename a folder, moving every card in it to the new name. Renaming to the
 * same name (modulo case) is allowed and just relabels; renaming onto a
 * different existing folder is rejected rather than silently merging.
 */
export function renameFolder(
  deck: Deck,
  oldName: string,
  newName: string,
): DeckResult {
  const trimmed = newName.trim();
  if (!deck.folders.includes(oldName)) {
    return { ok: false, error: `There's no folder named "${oldName}".` };
  }
  if (!trimmed) {
    return { ok: false, error: "Folder name can't be empty." };
  }
  const collides = deck.folders.some(
    (folder) => folder !== oldName && key(folder) === key(trimmed),
  );
  if (collides) {
    return { ok: false, error: `A folder named "${trimmed}" already exists.` };
  }
  return {
    ok: true,
    deck: {
      cards: deck.cards.map((card) =>
        card.folder === oldName ? { ...card, folder: trimmed } : card,
      ),
      folders: deck.folders.map((folder) =>
        folder === oldName ? trimmed : folder,
      ),
    },
  };
}

/**
 * Pick a free name for a copy of `base`, e.g. `Animals copy`, then
 * `Animals copy 2`, `Animals copy 3`, ... skipping any that already exist
 * (compared case-insensitively).
 */
function uniqueCopyName(folders: string[], base: string): string {
  const taken = new Set(folders.map(key));
  const first = `${base} copy`;
  if (!taken.has(key(first))) return first;
  let n = 2;
  while (taken.has(key(`${base} copy ${n}`))) n++;
  return `${base} copy ${n}`;
}

/**
 * Duplicate a folder and every card in it into a new folder named
 * `"<folder> copy"` (deduplicated if that name is taken). The copies are fresh
 * cards with new ids, so editing or moving them never touches the originals. The
 * new folder is inserted right after the source folder.
 */
export function duplicateFolder(deck: Deck, name: string): DuplicateResult {
  if (!deck.folders.includes(name)) {
    return { ok: false, error: `There's no folder named "${name}".` };
  }
  const newName = uniqueCopyName(deck.folders, name);
  const copies = deck.cards
    .filter((card) => card.folder === name)
    .map((card) => createCard(card.japanese, card.english, newName));

  const folders = [...deck.folders];
  folders.splice(folders.indexOf(name) + 1, 0, newName);

  return {
    ok: true,
    deck: { cards: [...deck.cards, ...copies], folders },
    name: newName,
  };
}

/**
 * Add a new card to a folder. Both the Japanese and English text are required;
 * a blank value is rejected. The target folder is created if it doesn't exist
 * yet, mirroring {@link moveCard}.
 */
export function addCard(
  deck: Deck,
  japanese: string,
  english: string,
  folder: string,
): DeckResult {
  const j = japanese.trim();
  const e = english.trim();
  const missing: string[] = [];
  if (!j) missing.push("Japanese");
  if (!e) missing.push("English");
  if (missing.length > 0) {
    return { ok: false, error: `Add the ${missing.join(" and ")} text first.` };
  }

  const target = folder.trim() || DEFAULT_FOLDER;
  const folders = deck.folders.some((f) => key(f) === key(target))
    ? deck.folders
    : [...deck.folders, target];
  return {
    ok: true,
    deck: { cards: [...deck.cards, createCard(j, e, target)], folders },
  };
}

/**
 * Remove a single card from the deck. Folders are left untouched, so a folder
 * that empties out stays in the list (consistent with how the app keeps empty
 * folders around) until it's deleted explicitly.
 */
export function removeCard(deck: Deck, cardId: string): Deck {
  return {
    ...deck,
    cards: deck.cards.filter((card) => card.id !== cardId),
  };
}

/**
 * Delete a folder. Any cards it holds fall back to {@link DEFAULT_FOLDER} (which
 * is re-created if those cards have nowhere else to land). Deleting the default
 * folder while it still holds cards is a no-op, since there's no safer home.
 */
export function removeFolder(deck: Deck, name: string): Deck {
  const hasCards = deck.cards.some((card) => card.folder === name);
  if (name === DEFAULT_FOLDER && hasCards) return deck;

  const cards = deck.cards.map((card) =>
    card.folder === name ? { ...card, folder: DEFAULT_FOLDER } : card,
  );
  let folders = deck.folders.filter((folder) => folder !== name);
  if (hasCards && !folders.includes(DEFAULT_FOLDER)) {
    folders = [...folders, DEFAULT_FOLDER];
  }
  return { cards, folders };
}

/**
 * Move a single card into a folder. The target folder is added to the list if
 * it isn't there yet, so moving into a just-typed name works in one step.
 */
export function moveCard(deck: Deck, cardId: string, folder: string): Deck {
  const target = folder.trim();
  const folders = deck.folders.some((f) => key(f) === key(target))
    ? deck.folders
    : [...deck.folders, target];
  return {
    cards: deck.cards.map((card) =>
      card.id === cardId ? { ...card, folder: target } : card,
    ),
    folders,
  };
}
