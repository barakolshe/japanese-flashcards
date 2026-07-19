"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";
import { selectDeck, selectDeckByCollections } from "@/lib/study";
import { DeckOrganize } from "./deck-organize";
import { StudySession } from "./study-session";
import { StudySetup } from "./study-setup";
import { WordListScreen } from "./word-list";

/**
 * What the user chose to study. `undefined` means not yet studying; otherwise a
 * whole deck, a single collection, a whole folder (all its collections), or an
 * explicit set of collections (used by the tag filter — "study everything
 * shown") with a title to label the session.
 *
 * `quiz` is special: rather than a descriptor resolved here, it carries an
 * already-sampled set of cards (the streak-weighted 50-word draw, picked at the
 * moment the button is clicked) plus a `nonce` so each click starts a fresh
 * session even when the same cards happen to be drawn again.
 */
export type StudyTarget =
  | { kind: "all" }
  | { kind: "collection"; name: string }
  | { kind: "folder"; name: string }
  | { kind: "collections"; names: string[]; title: string }
  | { kind: "quiz"; cards: Flashcard[]; title: string; nonce: number };
type Target = StudyTarget | undefined;

/**
 * Owns the loaded-deck experience: the study setup screen, the organize screen,
 * and the active study session once a target is chosen.
 */
export function DeckStudy() {
  // Which side leads lives in the store so it's restored alongside the deck and
  // persisted on change — it survives leaving a session and applies to every
  // target, not just the one studied first.
  const { cards, folders, front, setFront, recordResults } = useFlashcards();
  const [target, setTarget] = useState<Target>(undefined);
  const [organizing, setOrganizing] = useState(false);
  // The collection whose word list is open (a read-only review screen reached
  // from the dashboard), or undefined when not viewing a list.
  const [viewing, setViewing] = useState<string | undefined>(undefined);

  if (target) {
    let deck: Flashcard[];
    let title: string;
    if (target.kind === "all") {
      deck = selectDeck(cards, null);
      title = "All cards";
    } else if (target.kind === "quiz") {
      deck = target.cards;
      title = target.title;
    } else if (target.kind === "collection") {
      deck = selectDeck(cards, target.name);
      title = target.name;
    } else if (target.kind === "folder") {
      const folder = folders.find((f) => f.name === target.name);
      deck = selectDeckByCollections(cards, folder?.collections ?? []);
      title = target.name;
    } else {
      deck = selectDeckByCollections(cards, target.names);
      title = target.title;
    }

    return (
      <StudySession
        // Remount with a fresh session when the study target changes.
        key={
          target.kind === "all"
            ? "all"
            : target.kind === "quiz"
              ? `quiz:${target.nonce}`
              : target.kind === "collections"
                ? `collections:${target.title}:${target.names.join(",")}`
                : `${target.kind}:${target.name}`
        }
        deck={deck}
        title={title}
        front={front}
        onFrontChange={setFront}
        onRoundComplete={recordResults}
        onExit={() => setTarget(undefined)}
      />
    );
  }

  if (organizing) {
    return <DeckOrganize onBack={() => setOrganizing(false)} />;
  }

  if (viewing !== undefined) {
    return (
      <WordListScreen
        title={viewing}
        cards={selectDeck(cards, viewing)}
        onBack={() => setViewing(undefined)}
      />
    );
  }

  return (
    <StudySetup
      front={front}
      onFrontChange={setFront}
      onStart={setTarget}
      onOrganize={() => setOrganizing(true)}
      onViewList={setViewing}
    />
  );
}
