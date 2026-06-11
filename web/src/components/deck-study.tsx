"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";
import { selectDeck, selectDeckByCollections } from "@/lib/study";
import { orientationFor } from "@/lib/study-direction";
import { DeckOrganize } from "./deck-organize";
import { StudySession } from "./study-session";
import { StudySetup } from "./study-setup";

/**
 * What the user chose to study. `undefined` means not yet studying; otherwise a
 * whole deck, a single collection, or a whole folder (all its collections).
 */
export type StudyTarget =
  | { kind: "all" }
  | { kind: "collection"; name: string }
  | { kind: "folder"; name: string };
type Target = StudyTarget | undefined;

/**
 * Owns the loaded-deck experience: the study setup screen, the organize screen,
 * and the active study session once a target is chosen.
 */
export function DeckStudy() {
  // Which side leads lives in the store so it's restored alongside the deck and
  // persisted on change — it survives leaving a session and applies to every
  // target, not just the one studied first.
  const { cards, folders, front, setFront } = useFlashcards();
  const [target, setTarget] = useState<Target>(undefined);
  const [organizing, setOrganizing] = useState(false);

  if (target) {
    let deck: Flashcard[];
    let title: string;
    if (target.kind === "all") {
      deck = selectDeck(cards, null);
      title = "All cards";
    } else if (target.kind === "collection") {
      deck = selectDeck(cards, target.name);
      title = target.name;
    } else {
      const folder = folders.find((f) => f.name === target.name);
      deck = selectDeckByCollections(cards, folder?.collections ?? []);
      title = target.name;
    }

    return (
      <StudySession
        // Remount with a fresh session when the study target changes.
        key={`${target.kind}:${target.kind === "all" ? "" : target.name}`}
        deck={deck}
        title={title}
        orientation={orientationFor(front)}
        onExit={() => setTarget(undefined)}
      />
    );
  }

  if (organizing) {
    return <DeckOrganize onBack={() => setOrganizing(false)} />;
  }

  return (
    <StudySetup
      front={front}
      onFrontChange={setFront}
      onStart={setTarget}
      onOrganize={() => setOrganizing(true)}
    />
  );
}
