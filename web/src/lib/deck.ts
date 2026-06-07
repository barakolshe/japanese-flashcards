import { DEFAULT_FOLDER, folderNames, type Flashcard } from "./flashcards";

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

/** Case-insensitive, whitespace-insensitive key for comparing folder names. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/** Build a fresh deck from a parsed set of cards. */
export function deckFromCards(cards: Flashcard[]): Deck {
  return { cards, folders: folderNames(cards) };
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
