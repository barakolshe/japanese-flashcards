"use client";

import { useState } from "react";
import { useFlashcards } from "@/lib/flashcards-store";
import { selectDeck } from "@/lib/study";
import { orientationFor } from "@/lib/study-direction";
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
  // Which side leads lives in the store so it's restored alongside the deck and
  // persisted on change — it survives leaving a session and applies to every
  // folder, not just the deck studied first.
  const { cards, front, setFront } = useFlashcards();
  const [target, setTarget] = useState<Target>(undefined);
  const [organizing, setOrganizing] = useState(false);

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
