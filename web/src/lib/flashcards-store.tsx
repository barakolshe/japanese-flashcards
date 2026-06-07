"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Flashcard } from "./flashcards";

type FlashcardsStore = {
  /** Cards loaded from the most recent upload. Empty until a file is loaded. */
  cards: Flashcard[];
  /** Replace the current deck with a freshly parsed set of cards. */
  loadCards: (cards: Flashcard[]) => void;
  /** Clear the loaded deck (back to the empty/upload state). */
  clear: () => void;
};

const FlashcardsContext = createContext<FlashcardsStore | null>(null);

export function FlashcardsProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<Flashcard[]>([]);

  const loadCards = useCallback((next: Flashcard[]) => setCards(next), []);
  const clear = useCallback(() => setCards([]), []);

  const value = useMemo<FlashcardsStore>(
    () => ({ cards, loadCards, clear }),
    [cards, loadCards, clear],
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
