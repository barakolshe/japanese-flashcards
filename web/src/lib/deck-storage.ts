import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import type { CardStat, CardStats } from "./card-stats";
import type { Deck, Folder, Tag } from "./deck";
import { getDb } from "./firebase";
import type { Flashcard } from "./flashcards";
import type { CardFront } from "./study-direction";

/**
 * Remote persistence for the user's deck and study preference, backed by
 * Firestore. The app is single-user with no accounts, so the entire state lives
 * in two fixed documents — one for the deck, one for the "show first" direction —
 * not a per-user collection. The deck is the user's main state, saved after
 * every change and reloaded on the next visit (here or on another device).
 *
 * The stored deck is versioned so the shape can evolve; anything we can't read
 * back cleanly — wrong version, wrong shape, or a network/permission error — is
 * treated as "nothing saved" rather than surfaced as a half-broken deck.
 */

/**
 * Bump when the stored deck shape changes incompatibly. Payloads from an older
 * version are migrated forward when we know how (see {@link migrateDeck}) and
 * otherwise dropped.
 */
const STORAGE_VERSION = 2;
/** Single document each, since there's exactly one user and one of everything. */
const COLLECTION = "flashcards";
const DECK_DOC = "deck";
const FRONT_DOC = "front";
const STATS_DOC = "stats";

function deckRef() {
  return doc(getDb(), COLLECTION, DECK_DOC);
}

function frontRef() {
  return doc(getDb(), COLLECTION, FRONT_DOC);
}

function statsRef() {
  return doc(getDb(), COLLECTION, STATS_DOC);
}

function isFlashcard(value: unknown): value is Flashcard {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    typeof card.japanese === "string" &&
    typeof card.english === "string" &&
    typeof card.collection === "string" &&
    (card.pronunciation === undefined ||
      typeof card.pronunciation === "string")
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFolder(value: unknown): value is Folder {
  if (typeof value !== "object" || value === null) return false;
  const folder = value as Record<string, unknown>;
  return typeof folder.name === "string" && isStringArray(folder.collections);
}

function isTag(value: unknown): value is Tag {
  if (typeof value !== "object" || value === null) return false;
  const tag = value as Record<string, unknown>;
  return typeof tag.name === "string" && typeof tag.color === "string";
}

function isCollectionTags(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(isStringArray);
}

/**
 * Validate a stored v2 deck. `tags`/`collectionTags` are optional so decks saved
 * before tagging existed still pass (normalized to empty tag state by
 * {@link normalizeDeck}); when present they're validated.
 */
function isStoredDeck(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const deck = value as Record<string, unknown>;
  if (!(Array.isArray(deck.cards) && deck.cards.every(isFlashcard))) {
    return false;
  }
  if (!isStringArray(deck.collections)) return false;
  if (!(Array.isArray(deck.folders) && deck.folders.every(isFolder))) {
    return false;
  }
  if (
    deck.tags !== undefined &&
    !(Array.isArray(deck.tags) && deck.tags.every(isTag))
  ) {
    return false;
  }
  if (deck.collectionTags !== undefined && !isCollectionTags(deck.collectionTags)) {
    return false;
  }
  return true;
}

/** Fill in tag fields a pre-tagging deck won't have, so callers get a full Deck. */
function normalizeDeck(value: unknown): Deck {
  const deck = value as Record<string, unknown>;
  return {
    cards: deck.cards as Deck["cards"],
    collections: deck.collections as string[],
    folders: deck.folders as Folder[],
    tags: (deck.tags as Tag[] | undefined) ?? [],
    collectionTags:
      (deck.collectionTags as Record<string, string[]> | undefined) ?? {},
  };
}

/** A version-1 card: the collection lived in a `folder` field, no folder layer. */
type V1Flashcard = {
  id: string;
  japanese: string;
  english: string;
  folder: string;
};

function isV1Flashcard(value: unknown): value is V1Flashcard {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    typeof card.japanese === "string" &&
    typeof card.english === "string" &&
    typeof card.folder === "string"
  );
}

/**
 * Bring a stored payload up to the current shape. Version 1 stored each card's
 * collection in a `folder` field and the collection list in `folders` (with no
 * folder/directory layer); map those to today's `collection`/`collections` and
 * start with no folders. Returns `null` when the payload can't be migrated.
 */
function migrateDeck(version: unknown, deck: unknown): Deck | null {
  if (version === STORAGE_VERSION) {
    return isStoredDeck(deck) ? normalizeDeck(deck) : null;
  }
  if (version === 1) {
    if (typeof deck !== "object" || deck === null) return null;
    const v1 = deck as Record<string, unknown>;
    if (!Array.isArray(v1.cards) || !v1.cards.every(isV1Flashcard)) return null;
    if (!isStringArray(v1.folders)) return null;
    return {
      cards: (v1.cards as V1Flashcard[]).map(({ id, japanese, english, folder }) => ({
        id,
        japanese,
        english,
        collection: folder,
      })),
      collections: v1.folders,
      folders: [],
      tags: [],
      collectionTags: {},
    };
  }
  return null;
}

/**
 * Read the saved deck, or `null` if there's nothing valid to restore. Resolves
 * to `null` (never rejects) on a missing document, an old version, a shape that
 * no longer matches, or a network/permission error — the caller just starts from
 * an empty deck.
 */
export async function loadStoredDeck(): Promise<Deck | null> {
  let data: Record<string, unknown> | undefined;
  try {
    const snap = await getDoc(deckRef());
    if (!snap.exists()) return null;
    data = snap.data();
  } catch {
    // Offline, misconfigured, or denied by rules — restore nothing.
    return null;
  }
  if (!data) return null;
  return migrateDeck(data.version, data.deck);
}

/** Persist the deck, silently ignoring write errors (offline, rules, etc.). */
export async function saveDeck(deck: Deck): Promise<void> {
  try {
    await setDoc(deckRef(), { version: STORAGE_VERSION, deck });
  } catch {
    // Nothing actionable for the user mid-study; the change stays in memory.
  }
}

/** Forget the saved deck entirely (used when clearing back to the upload state). */
export async function clearStoredDeck(): Promise<void> {
  try {
    await deleteDoc(deckRef());
  } catch {
    // Ignore — there's nothing the user can do about a failed delete.
  }
}

/** Read the saved "show first" direction, or `null` if none/invalid is stored. */
export async function loadStoredFront(): Promise<CardFront | null> {
  let value: unknown;
  try {
    const snap = await getDoc(frontRef());
    if (!snap.exists()) return null;
    value = snap.data().front;
  } catch {
    return null;
  }
  return value === "japanese" || value === "english" ? value : null;
}

/** Persist the chosen "show first" direction so it survives a refresh or device. */
export async function saveFront(front: CardFront): Promise<void> {
  try {
    await setDoc(frontRef(), { front });
  } catch {
    // The preference just won't stick; not worth interrupting the user.
  }
}

function isCardStat(value: unknown): value is CardStat {
  if (typeof value !== "object" || value === null) return false;
  const stat = value as Record<string, unknown>;
  return typeof stat.successes === "number" && typeof stat.streak === "number";
}

function isCardStats(value: unknown): value is CardStats {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(isCardStat);
}

/**
 * Read the saved per-word stats, or an empty map if nothing valid is stored.
 * Resolves to `{}` (never rejects) on a missing document, a shape that no longer
 * matches, or a network/permission error — the caller just starts fresh.
 */
export async function loadStoredCardStats(): Promise<CardStats> {
  let value: unknown;
  try {
    const snap = await getDoc(statsRef());
    if (!snap.exists()) return {};
    value = snap.data().stats;
  } catch {
    return {};
  }
  return isCardStats(value) ? value : {};
}

/** Persist the per-word stats, silently ignoring write errors (offline, rules). */
export async function saveCardStats(stats: CardStats): Promise<void> {
  try {
    await setDoc(statsRef(), { stats });
  } catch {
    // The stats just won't stick this time; not worth interrupting study.
  }
}

/** Forget all saved per-word stats (used when clearing the deck). */
export async function clearStoredCardStats(): Promise<void> {
  try {
    await deleteDoc(statsRef());
  } catch {
    // Ignore — there's nothing the user can do about a failed delete.
  }
}
