import {
  createCard,
  DEFAULT_FOLDER,
  folderNames,
  type Flashcard,
} from "./flashcards";

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
 * new folder is inserted right after the source folder and inherits its tags.
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

  // The copy starts with the same tags as its source.
  const folderTags = { ...deck.folderTags };
  if (deck.folderTags[name]) folderTags[newName] = [...deck.folderTags[name]];

  return {
    ok: true,
    deck: { cards: [...deck.cards, ...copies], folders, tags: deck.tags, folderTags },
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
    deck: {
      cards: [...deck.cards, createCard(j, e, target)],
      folders,
      tags: deck.tags,
      folderTags: deck.folderTags,
    },
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
