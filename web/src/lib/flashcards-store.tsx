"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addFolder as addFolderTo,
  addFolderTag as addFolderTagTo,
  appendCards as appendCardsTo,
  deckFromCards,
  moveCard as moveCardIn,
  removeFolder as removeFolderFrom,
  removeFolderTag as removeFolderTagFrom,
  renameFolder as renameFolderIn,
  type Deck,
  type DeckResult,
  type Tag,
} from "./deck";
import {
  clearStoredDeck,
  loadStoredDeck,
  loadStoredFront,
  saveDeck,
  saveFront,
} from "./deck-storage";
import type { Flashcard } from "./flashcards";
import type { CardFront } from "./study-direction";

type FlashcardsStore = {
  /**
   * Whether the saved state has been read from Firestore yet. `false` on the
   * first render (and during SSR); the UI waits for it before deciding between
   * the upload and study screens so a saved deck doesn't flash the upload view.
   */
  hydrated: boolean;
  /** Cards loaded from the most recent upload. Empty until a file is loaded. */
  cards: Flashcard[];
  /** Every folder cards can be sorted into, including freshly created empty ones. */
  folders: string[];
  /** The tags in use across folders, with their colors, in creation order. */
  tags: Tag[];
  /** Tag names pinned to each folder, keyed by folder name. */
  folderTags: Record<string, string[]>;
  /** Which side cards show first; persisted alongside the deck. */
  front: CardFront;
  /** Change which side leads, persisting the choice. */
  setFront: (front: CardFront) => void;
  /** Replace the current deck with a freshly parsed set of cards. */
  loadCards: (cards: Flashcard[]) => void;
  /** Append freshly imported cards to the current deck, keeping what's there. */
  addCards: (cards: Flashcard[]) => void;
  /** Clear the loaded deck (back to the empty/upload state). */
  clear: () => void;
  /** Create a new, empty folder. Returns a validation error if the name is taken or blank. */
  addFolder: (name: string) => DeckResult;
  /** Rename a folder, relabeling every card in it. Returns a validation error on conflict. */
  renameFolder: (oldName: string, newName: string) => DeckResult;
  /** Delete a folder; its cards fall back to the default folder. */
  removeFolder: (name: string) => void;
  /** Move a single card into a folder (creating that folder if it's new). */
  moveCard: (cardId: string, folder: string) => void;
  /** Pin a tag to a folder, creating it with the given color if it's new. */
  addFolderTag: (folder: string, name: string, color: string) => DeckResult;
  /** Unpin a tag from a folder; a tag left on no folders disappears. */
  removeFolderTag: (folder: string, name: string) => void;
};

const FlashcardsContext = createContext<FlashcardsStore | null>(null);

const EMPTY_DECK: Deck = { cards: [], folders: [], tags: [], folderTags: {} };

function isEmptyDeck(deck: Deck): boolean {
  return deck.cards.length === 0 && deck.folders.length === 0;
}

export function FlashcardsProvider({ children }: { children: React.ReactNode }) {
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);
  const [front, setFront] = useState<CardFront>("japanese");
  const [hydrated, setHydrated] = useState(false);

  // Restore the saved deck and study direction once, on the client. Firestore
  // reads are async, so we resolve both before flipping `hydrated` — the UI
  // stays on its loading placeholder until the real state is in hand, which
  // also keeps the direction toggle from flashing its default then correcting.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadStoredDeck(), loadStoredFront()]).then(
      ([storedDeck, storedFront]) => {
        if (cancelled) return;
        if (storedDeck) setDeck(storedDeck);
        if (storedFront) setFront(storedFront);
        setHydrated(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the deck on every change once hydrated. Guarding on `hydrated` keeps
  // the initial empty deck from clobbering a saved one before it's restored.
  useEffect(() => {
    if (!hydrated) return;
    if (isEmptyDeck(deck)) void clearStoredDeck();
    else void saveDeck(deck);
  }, [deck, hydrated]);

  // Persist the direction the same way, once the saved one has been restored.
  useEffect(() => {
    if (!hydrated) return;
    void saveFront(front);
  }, [front, hydrated]);

  const loadCards = useCallback(
    (next: Flashcard[]) => setDeck(deckFromCards(next)),
    [],
  );
  const addCards = useCallback((next: Flashcard[]) => {
    setDeck((current) => appendCardsTo(current, next));
  }, []);
  const clear = useCallback(() => setDeck(EMPTY_DECK), []);

  // add/rename validate and report back synchronously, so they run against the
  // current deck from this render rather than a functional updater.
  const addFolder = useCallback(
    (name: string): DeckResult => {
      const result = addFolderTo(deck, name);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const renameFolder = useCallback(
    (oldName: string, newName: string): DeckResult => {
      const result = renameFolderIn(deck, oldName, newName);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const removeFolder = useCallback((name: string) => {
    setDeck((current) => removeFolderFrom(current, name));
  }, []);

  const moveCard = useCallback((cardId: string, folder: string) => {
    setDeck((current) => moveCardIn(current, cardId, folder));
  }, []);

  // Validates against the current deck and reports back synchronously, like
  // addFolder, so the UI can surface a blank-name error inline.
  const addFolderTag = useCallback(
    (folder: string, name: string, color: string): DeckResult => {
      const result = addFolderTagTo(deck, folder, name, color);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const removeFolderTag = useCallback((folder: string, name: string) => {
    setDeck((current) => removeFolderTagFrom(current, folder, name));
  }, []);

  const value = useMemo<FlashcardsStore>(
    () => ({
      hydrated,
      cards: deck.cards,
      folders: deck.folders,
      tags: deck.tags,
      folderTags: deck.folderTags,
      front,
      setFront,
      loadCards,
      addCards,
      clear,
      addFolder,
      renameFolder,
      removeFolder,
      moveCard,
      addFolderTag,
      removeFolderTag,
    }),
    [
      hydrated,
      deck,
      front,
      loadCards,
      addCards,
      clear,
      addFolder,
      renameFolder,
      removeFolder,
      moveCard,
      addFolderTag,
      removeFolderTag,
    ],
  );

  return (
    <FlashcardsContext.Provider value={value}>
      {children}
    </FlashcardsContext.Provider>
  );
}

export function useFlashcards(): FlashcardsStore {
  const store = useContext(FlashcardsContext);
  if (!store) {
    throw new Error("useFlashcards must be used within a FlashcardsProvider");
  }
  return store;
}
