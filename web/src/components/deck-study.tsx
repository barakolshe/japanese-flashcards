"use client";

import { useState } from "react";
import { useFlashcards } from "@/lib/flashcards-store";
import { selectDeck } from "@/lib/study";
import { orientationFor, type CardFront } from "@/lib/study-direction";
import { DeckOrganize } from "./deck-organize";
import { StudySession } from "./study-session";
import { StudySetup } from "./study-setup";

/** Folder to study, or `null` for the whole deck. `undefined` means not yet studying. */
type Target = { folder: string | null } | undefined;

/**
 * Owns the loaded-deck experience: the study setup screen, the organize screen,
 * and the active study session once a target is chosen.
 */
export function DeckStudy() {
  const { cards } = useFlashcards();
  const [target, setTarget] = useState<Target>(undefined);
  const [organizing, setOrganizing] = useState(false);
  // Which side leads. Kept here so the choice survives leaving a session and
  // applies to every folder, not just the deck studied first.
  const [front, setFront] = useState<CardFront>("japanese");

  if (target) {
    const deck = selectDeck(cards, target.folder);
    return (
      <StudySession
        // Remount with a fresh session when the study target changes.
        key={target.folder ?? "__all__"}
        deck={deck}
        title={target.folder ?? "All cards"}
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
      onStart={(folder) => setTarget({ folder })}
      onOrganize={() => setOrganizing(true)}
    />
  );
}
