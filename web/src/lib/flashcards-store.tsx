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
  addCard as addCardTo,
  addCollection as addCollectionTo,
  addCollectionTag as addCollectionTagTo,
  addFolder as addFolderTo,
  appendCards as appendCardsTo,
  deckFromCards,
  duplicateCollection as duplicateCollectionIn,
  moveCard as moveCardIn,
  moveCollection as moveCollectionIn,
  removeCard as removeCardFrom,
  removeCollection as removeCollectionFrom,
  removeCollectionTag as removeCollectionTagFrom,
  removeFolder as removeFolderFrom,
  renameCollection as renameCollectionIn,
  renameFolder as renameFolderIn,
  type Deck,
  type DeckResult,
  type DuplicateResult,
  type Folder,
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
  /** Every collection cards can be sorted into, including freshly created empty ones. */
  collections: string[];
  /** Folders grouping collections; the directory layer above collections. */
  folders: Folder[];
  /** The tags in use across collections, with their colors, in creation order. */
  tags: Tag[];
  /** Tag names pinned to each collection, keyed by collection name. */
  collectionTags: Record<string, string[]>;
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
  /** Create a new, empty collection. Returns a validation error if the name is taken or blank. */
  addCollection: (name: string) => DeckResult;
  /** Rename a collection, relabeling every card in it. Returns a validation error on conflict. */
  renameCollection: (oldName: string, newName: string) => DeckResult;
  /** Delete a collection; its cards fall back to the default collection. */
  removeCollection: (name: string) => void;
  /** Copy a collection and its cards into a new "<name> copy"; returns the copy's name. */
  duplicateCollection: (name: string) => DuplicateResult;
  /** Add a new card to a collection. Returns a validation error if text is blank. */
  addCard: (japanese: string, english: string, collection: string) => DeckResult;
  /** Move a single card into a collection (creating that collection if it's new). */
  moveCard: (cardId: string, collection: string) => void;
  /** Delete a single card from the deck. */
  removeCard: (cardId: string) => void;
  /** Create a new, empty folder. Returns a validation error if the name is taken or blank. */
  addFolder: (name: string) => DeckResult;
  /** Rename a folder. Returns a validation error on conflict. */
  renameFolder: (oldName: string, newName: string) => DeckResult;
  /** Delete a folder; its collections become ungrouped (cards untouched). */
  removeFolder: (name: string) => void;
  /** File a collection under a folder, or ungroup it when `folder` is `null`. */
  moveCollection: (collection: string, folder: string | null) => void;
  /** Pin a tag to a collection, creating it with the given color if it's new. */
  addCollectionTag: (collection: string, name: string, color: string) => DeckResult;
  /** Unpin a tag from a collection; a tag left on no collections disappears. */
  removeCollectionTag: (collection: string, name: string) => void;
};

const FlashcardsContext = createContext<FlashcardsStore | null>(null);

const EMPTY_DECK: Deck = {
  cards: [],
  collections: [],
  folders: [],
  tags: [],
  collectionTags: {},
};

function isEmptyDeck(deck: Deck): boolean {
  return (
    deck.cards.length === 0 &&
    deck.collections.length === 0 &&
    deck.folders.length === 0
  );
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
  const addCollection = useCallback(
    (name: string): DeckResult => {
      const result = addCollectionTo(deck, name);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const renameCollection = useCallback(
    (oldName: string, newName: string): DeckResult => {
      const result = renameCollectionIn(deck, oldName, newName);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const removeCollection = useCallback((name: string) => {
    setDeck((current) => removeCollectionFrom(current, name));
  }, []);

  const moveCard = useCallback((cardId: string, collection: string) => {
    setDeck((current) => moveCardIn(current, cardId, collection));
  }, []);

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

  const moveCollection = useCallback(
    (collection: string, folder: string | null) => {
      setDeck((current) => moveCollectionIn(current, collection, folder));
    },
    [],
  );

  const duplicateCollection = useCallback(
    (name: string): DuplicateResult => {
      const result = duplicateCollectionIn(deck, name);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const addCard = useCallback(
    (japanese: string, english: string, collection: string): DeckResult => {
      const result = addCardTo(deck, japanese, english, collection);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const removeCard = useCallback((cardId: string) => {
    setDeck((current) => removeCardFrom(current, cardId));
  }, []);

  // Validates against the current deck and reports back synchronously, like
  // addCollection, so the UI can surface a blank-name error inline.
  const addCollectionTag = useCallback(
    (collection: string, name: string, color: string): DeckResult => {
      const result = addCollectionTagTo(deck, collection, name, color);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const removeCollectionTag = useCallback(
    (collection: string, name: string) => {
      setDeck((current) => removeCollectionTagFrom(current, collection, name));
    },
    [],
  );

  const value = useMemo<FlashcardsStore>(
    () => ({
      hydrated,
      cards: deck.cards,
      collections: deck.collections,
      folders: deck.folders,
      tags: deck.tags,
      collectionTags: deck.collectionTags,
      front,
      setFront,
      loadCards,
      addCards,
      clear,
      addCollection,
      renameCollection,
      removeCollection,
      duplicateCollection,
      addCard,
      moveCard,
      removeCard,
      addFolder,
      renameFolder,
      removeFolder,
      moveCollection,
      addCollectionTag,
      removeCollectionTag,
    }),
    [
      hydrated,
      deck,
      front,
      loadCards,
      addCards,
      clear,
      addCollection,
      renameCollection,
      removeCollection,
      duplicateCollection,
      addCard,
      moveCard,
      removeCard,
      addFolder,
      renameFolder,
      removeFolder,
      moveCollection,
      addCollectionTag,
      removeCollectionTag,
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
