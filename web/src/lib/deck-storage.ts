import type { Deck } from "./deck";
import type { Flashcard } from "./flashcards";

/**
 * Local persistence for the working deck. The deck is the user's only state, so
 * we save it to `localStorage` after every change and reload it on the next
 * visit — no account, no server, no sync. The stored value is versioned so the
 * shape can evolve; anything we can't read back cleanly is discarded rather than
 * surfaced as a half-broken deck.
 */

/** Bump when the stored shape changes incompatibly; older payloads are dropped. */
const STORAGE_VERSION = 1;
const STORAGE_KEY = "flashcards:deck:v1";

type StoredDeck = {
  version: number;
  deck: Deck;
};

/** Whether `localStorage` is usable (it isn't during SSR or in locked-down browsers). */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Accessing localStorage can throw when cookies/storage are blocked.
    return null;
  }
}

function isFlashcard(value: unknown): value is Flashcard {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    typeof card.japanese === "string" &&
    typeof card.english === "string" &&
    typeof card.folder === "string"
  );
}

function isDeck(value: unknown): value is Deck {
  if (typeof value !== "object" || value === null) return false;
  const deck = value as Record<string, unknown>;
  return (
    Array.isArray(deck.cards) &&
    deck.cards.every(isFlashcard) &&
    Array.isArray(deck.folders) &&
    deck.folders.every((folder) => typeof folder === "string")
  );
}

/**
 * Read the saved deck, or `null` if there's nothing valid to restore. Returns
 * `null` (never throws) on missing storage, corrupt JSON, an old version, or a
 * shape that no longer matches — the caller just starts from an empty deck.
 */
export function loadStoredDeck(): Deck | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const stored = parsed as Partial<StoredDeck>;
  if (stored.version !== STORAGE_VERSION) return null;
  if (!isDeck(stored.deck)) return null;

  return stored.deck;
}

/** Persist the deck, silently ignoring storage errors (e.g. quota, private mode). */
export function saveDeck(deck: Deck): void {
  const storage = getStorage();
  if (!storage) return;

  const payload: StoredDeck = { version: STORAGE_VERSION, deck };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Out of quota or storage disabled — nothing actionable for the user.
  }
}

/** Forget the saved deck entirely (used by "Load a different file"). */
export function clearStoredDeck(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — there's nothing the user can do about a failed delete.
  }
}
