import { DEFAULT_FOLDER, folderNames, type Flashcard } from "./flashcards";

/** A tag the user can pin to folders, with a color from the tag palette. */
export type Tag = {
  /** Display name as first typed; compared case-insensitively elsewhere. */
  name: string;
  /** CSS color value (from `tag-colors`) used to paint the tag. */
  color: string;
};

/**
 * A working deck: the loaded cards plus the list of folders the user can sort
 * them into. Folders are tracked separately from cards so a freshly created
 * folder can exist before any card is moved into it — an empty folder would
 * otherwise have nothing to anchor it. The list always contains every folder
 * referenced by a card, in first-seen order, followed by any empty folders the
 * user has added.
 *
 * Folders can be tagged: `tags` is the catalog of tags currently in use (with
 * their colors, in creation order) and `folderTags` maps a folder name to the
 * tag names pinned to it. Tags exist only while assigned — dropping a tag from
 * its last folder removes it from the catalog.
 */
export type Deck = {
  cards: Flashcard[];
  folders: string[];
  tags: Tag[];
  folderTags: Record<string, string[]>;
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
  return { cards, folders: folderNames(cards), tags: [], folderTags: {} };
}

/** The tag keys still pinned to at least one of the given folders. */
function usedTagKeys(
  folders: string[],
  folderTags: Record<string, string[]>,
): Set<string> {
  const used = new Set<string>();
  for (const folder of folders) {
    for (const tag of folderTags[folder] ?? []) used.add(key(tag));
  }
  return used;
}

/** Drop tags from the catalog that no folder references anymore. */
function pruneTags(
  tags: Tag[],
  folders: string[],
  folderTags: Record<string, string[]>,
): Tag[] {
  const used = usedTagKeys(folders, folderTags);
  return tags.filter((tag) => used.has(key(tag.name)));
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
  return {
    cards: [...deck.cards, ...cards],
    folders,
    tags: deck.tags,
    folderTags: deck.folderTags,
  };
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
  // Carry the folder's tags over to its new name.
  const folderTags = { ...deck.folderTags };
  if (oldName !== trimmed && oldName in folderTags) {
    folderTags[trimmed] = folderTags[oldName];
    delete folderTags[oldName];
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
      tags: deck.tags,
      folderTags,
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
  // The folder's tags go with it; any tag left on no folders drops out.
  const folderTags = { ...deck.folderTags };
  delete folderTags[name];
  return {
    cards,
    folders,
    tags: pruneTags(deck.tags, folders, folderTags),
    folderTags,
  };
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
    tags: deck.tags,
    folderTags: deck.folderTags,
  };
}

/** The color of a tag, looked up case-insensitively (undefined if unknown). */
export function tagColor(deck: Deck, name: string): string | undefined {
  return deck.tags.find((tag) => key(tag.name) === key(name))?.color;
}

/** Tag names pinned to a folder, in assignment order (empty if none). */
export function tagsForFolder(deck: Deck, folder: string): string[] {
  return deck.folderTags[folder] ?? [];
}

/** Folders carrying a given tag, in folder order. */
export function foldersForTag(deck: Deck, name: string): string[] {
  return deck.folders.filter((folder) =>
    (deck.folderTags[folder] ?? []).some((tag) => key(tag) === key(name)),
  );
}

/**
 * Pin a tag to a folder, creating it with `color` if the name is new to the
 * deck. A name matching an existing tag reuses that tag's spelling and color, so
 * `color` only applies to genuinely new tags. Re-adding a tag the folder already
 * has is a no-op. Rejects a blank name or an unknown folder.
 */
export function addFolderTag(
  deck: Deck,
  folder: string,
  name: string,
  color: string,
): DeckResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Tag name can't be empty." };
  }
  if (!deck.folders.includes(folder)) {
    return { ok: false, error: `There's no folder named "${folder}".` };
  }
  const existing = deck.tags.find((tag) => key(tag.name) === key(trimmed));
  const canonical = existing ? existing.name : trimmed;
  const current = deck.folderTags[folder] ?? [];
  if (current.some((tag) => key(tag) === key(canonical))) {
    return { ok: true, deck };
  }
  return {
    ok: true,
    deck: {
      ...deck,
      tags: existing ? deck.tags : [...deck.tags, { name: trimmed, color }],
      folderTags: { ...deck.folderTags, [folder]: [...current, canonical] },
    },
  };
}

/**
 * Unpin a tag from a folder. A folder left with no tags drops its entry, and a
 * tag left on no folders drops out of the catalog. Unknown folder or tag is a
 * no-op.
 */
export function removeFolderTag(deck: Deck, folder: string, name: string): Deck {
  const current = deck.folderTags[folder];
  if (!current) return deck;
  const next = current.filter((tag) => key(tag) !== key(name));
  if (next.length === current.length) return deck;

  const folderTags = { ...deck.folderTags };
  if (next.length === 0) delete folderTags[folder];
  else folderTags[folder] = next;

  return {
    ...deck,
    folderTags,
    tags: pruneTags(deck.tags, deck.folders, folderTags),
  };
}
