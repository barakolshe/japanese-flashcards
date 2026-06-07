"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  addFolder as addFolderTo,
  deckFromCards,
  moveCard as moveCardIn,
  removeFolder as removeFolderFrom,
  renameFolder as renameFolderIn,
  type Deck,
  type DeckResult,
} from "./deck";
import type { Flashcard } from "./flashcards";

type FlashcardsStore = {
  /** Cards loaded from the most recent upload. Empty until a file is loaded. */
  cards: Flashcard[];
  /** Every folder cards can be sorted into, including freshly created empty ones. */
  folders: string[];
  /** Replace the current deck with a freshly parsed set of cards. */
  loadCards: (cards: Flashcard[]) => void;
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
};

const FlashcardsContext = createContext<FlashcardsStore | null>(null);

const EMPTY_DECK: Deck = { cards: [], folders: [] };

export function FlashcardsProvider({ children }: { children: React.ReactNode }) {
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);

  const loadCards = useCallback(
    (next: Flashcard[]) => setDeck(deckFromCards(next)),
    [],
  );
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

  const value = useMemo<FlashcardsStore>(
    () => ({
      cards: deck.cards,
      folders: deck.folders,
      loadCards,
      clear,
      addFolder,
      renameFolder,
      removeFolder,
      moveCard,
    }),
    [deck, loadCards, clear, addFolder, renameFolder, removeFolder, moveCard],
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
