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
  addFolder as addFolderTo,
  appendCards as appendCardsTo,
  deckFromCards,
  duplicateFolder as duplicateFolderIn,
  moveCard as moveCardIn,
  removeCard as removeCardFrom,
  removeFolder as removeFolderFrom,
  renameFolder as renameFolderIn,
  type Deck,
  type DeckResult,
  type DuplicateResult,
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
  /** Copy a folder and its cards into a new "<folder> copy"; returns the copy's name. */
  duplicateFolder: (name: string) => DuplicateResult;
  /** Delete a folder; its cards fall back to the default folder. */
  removeFolder: (name: string) => void;
  /** Add a new card to a folder. Returns a validation error if text is blank. */
  addCard: (japanese: string, english: string, folder: string) => DeckResult;
  /** Move a single card into a folder (creating that folder if it's new). */
  moveCard: (cardId: string, folder: string) => void;
  /** Delete a single card from the deck. */
  removeCard: (cardId: string) => void;
};

const FlashcardsContext = createContext<FlashcardsStore | null>(null);

const EMPTY_DECK: Deck = { cards: [], folders: [] };

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

  const duplicateFolder = useCallback(
    (name: string): DuplicateResult => {
      const result = duplicateFolderIn(deck, name);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const removeFolder = useCallback((name: string) => {
    setDeck((current) => removeFolderFrom(current, name));
  }, []);

  const addCard = useCallback(
    (japanese: string, english: string, folder: string): DeckResult => {
      const result = addCardTo(deck, japanese, english, folder);
      if (result.ok) setDeck(result.deck);
      return result;
    },
    [deck],
  );

  const moveCard = useCallback((cardId: string, folder: string) => {
    setDeck((current) => moveCardIn(current, cardId, folder));
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setDeck((current) => removeCardFrom(current, cardId));
  }, []);

  const value = useMemo<FlashcardsStore>(
    () => ({
      hydrated,
      cards: deck.cards,
      folders: deck.folders,
      front,
      setFront,
      loadCards,
      addCards,
      clear,
      addFolder,
      renameFolder,
      duplicateFolder,
      removeFolder,
      addCard,
      moveCard,
      removeCard,
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
      duplicateFolder,
      removeFolder,
      addCard,
      moveCard,
      removeCard,
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
