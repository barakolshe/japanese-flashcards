import { describe, expect, it } from "vitest";
import { DEFAULT_FOLDER, type Flashcard } from "./flashcards";
import {
  addCard,
  addFolder,
  appendCards,
  deckFromCards,
  duplicateFolder,
  folderCounts,
  moveCard,
  removeCard,
  removeFolder,
  renameFolder,
  type Deck,
} from "./deck";

function card(id: string, folder: string): Flashcard {
  return { id, japanese: `j${id}`, english: `e${id}`, folder };
}

describe("deckFromCards", () => {
  it("derives folders from the cards in first-seen order", () => {
    const deck = deckFromCards([
      card("1", "Animals"),
      card("2", "Animals"),
      card("3", "Objects"),
    ]);
    expect(deck.folders).toEqual(["Animals", "Objects"]);
  });
});

describe("appendCards", () => {
  it("appends cards and keeps the existing cards and folders", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals", "Empty"],
    };
    const next = appendCards(deck, [card("2", "Animals")]);
    expect(next.cards.map((c) => c.id)).toEqual(["1", "2"]);
    expect(next.folders).toEqual(["Animals", "Empty"]);
  });

  it("adds new folders the imported cards introduce, after the existing ones", () => {
    const deck: Deck = { cards: [card("1", "Animals")], folders: ["Animals"] };
    const next = appendCards(deck, [card("2", "Objects")]);
    expect(next.folders).toEqual(["Animals", "Objects"]);
  });

  it("reuses an existing folder matched case-insensitively", () => {
    const deck: Deck = { cards: [card("1", "Animals")], folders: ["Animals"] };
    const next = appendCards(deck, [card("2", "animals")]);
    expect(next.folders).toEqual(["Animals"]);
  });
});

describe("folderCounts", () => {
  it("counts cards per folder and includes empty folders as zero", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals")],
      folders: ["Animals", "Phrases"],
    };
    const counts = folderCounts(deck);
    expect(counts.get("Animals")).toBe(2);
    expect(counts.get("Phrases")).toBe(0);
  });
});

describe("addFolder", () => {
  it("appends a new empty folder", () => {
    const deck: Deck = { cards: [card("1", "Animals")], folders: ["Animals"] };
    const result = addFolder(deck, "Phrases");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Animals", "Phrases"]);
    expect(result.deck.cards).toBe(deck.cards);
  });

  it("trims the name", () => {
    const deck: Deck = { cards: [], folders: [] };
    const result = addFolder(deck, "  Phrases  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Phrases"]);
  });

  it("rejects a blank name", () => {
    const result = addFolder({ cards: [], folders: [] }, "   ");
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate name case-insensitively", () => {
    const deck: Deck = { cards: [], folders: ["Animals"] };
    const result = addFolder(deck, "animals");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("already exists");
  });
});

describe("renameFolder", () => {
  it("renames the folder and relabels its cards", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      folders: ["Animals", "Objects"],
    };
    const result = renameFolder(deck, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Creatures", "Objects"]);
    expect(result.deck.cards[0].folder).toBe("Creatures");
    expect(result.deck.cards[1].folder).toBe("Objects");
  });

  it("allows a case-only rename", () => {
    const deck: Deck = { cards: [card("1", "animals")], folders: ["animals"] };
    const result = renameFolder(deck, "animals", "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Animals"]);
    expect(result.deck.cards[0].folder).toBe("Animals");
  });

  it("rejects renaming onto a different existing folder", () => {
    const deck: Deck = { cards: [], folders: ["Animals", "Objects"] };
    const result = renameFolder(deck, "Animals", "objects");
    expect(result.ok).toBe(false);
  });

  it("rejects a blank new name", () => {
    const deck: Deck = { cards: [], folders: ["Animals"] };
    expect(renameFolder(deck, "Animals", "  ").ok).toBe(false);
  });

  it("rejects renaming a folder that doesn't exist", () => {
    const deck: Deck = { cards: [], folders: ["Animals"] };
    expect(renameFolder(deck, "Ghost", "Phantom").ok).toBe(false);
  });
});

describe("duplicateFolder", () => {
  it("copies the folder and its cards into a '<name> copy' folder", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals"), card("3", "Objects")],
      folders: ["Animals", "Objects"],
    };
    const result = duplicateFolder(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Animals copy");
    // Inserted right after the source folder.
    expect(result.deck.folders).toEqual(["Animals", "Animals copy", "Objects"]);
    const copies = result.deck.cards.filter((c) => c.folder === "Animals copy");
    expect(copies).toHaveLength(2);
    expect(copies.map((c) => c.japanese)).toEqual(["j1", "j2"]);
  });

  it("gives the copies fresh ids and leaves the originals untouched", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals"],
    };
    const result = duplicateFolder(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.deck.cards.find((c) => c.folder === "Animals copy");
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe("1");
    // Original card is unchanged.
    expect(result.deck.cards[0]).toEqual(card("1", "Animals"));
  });

  it("deduplicates the copy name when one already exists", () => {
    const deck: Deck = {
      cards: [],
      folders: ["Animals", "Animals copy"],
    };
    const result = duplicateFolder(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Animals copy 2");
  });

  it("duplicates an empty folder with no cards", () => {
    const deck: Deck = { cards: [], folders: ["Phrases"] };
    const result = duplicateFolder(deck, "Phrases");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Phrases", "Phrases copy"]);
    expect(result.deck.cards).toEqual([]);
  });

  it("rejects duplicating a folder that doesn't exist", () => {
    const deck: Deck = { cards: [], folders: ["Animals"] };
    expect(duplicateFolder(deck, "Ghost").ok).toBe(false);
  });
});

describe("addCard", () => {
  it("adds a card to an existing folder", () => {
    const deck: Deck = { cards: [card("1", "Animals")], folders: ["Animals"] };
    const result = addCard(deck, "猫", "cat", "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toHaveLength(2);
    const added = result.deck.cards[1];
    expect(added).toMatchObject({ japanese: "猫", english: "cat", folder: "Animals" });
    expect(added.id).toBeTruthy();
    expect(result.deck.folders).toEqual(["Animals"]);
  });

  it("trims the text and creates the target folder when it's new", () => {
    const deck: Deck = { cards: [], folders: [] };
    const result = addCard(deck, "  犬  ", "  dog  ", "Verbs");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards[0]).toMatchObject({ japanese: "犬", english: "dog" });
    expect(result.deck.folders).toEqual(["Verbs"]);
  });

  it("rejects a blank Japanese or English value", () => {
    const deck: Deck = { cards: [], folders: ["Animals"] };
    expect(addCard(deck, "", "cat", "Animals").ok).toBe(false);
    expect(addCard(deck, "猫", "   ", "Animals").ok).toBe(false);
  });
});

describe("removeCard", () => {
  it("removes the card and keeps the folders", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals")],
      folders: ["Animals", "Objects"],
    };
    const next = removeCard(deck, "1");
    expect(next.cards.map((c) => c.id)).toEqual(["2"]);
    expect(next.folders).toEqual(["Animals", "Objects"]);
  });

  it("is a no-op for an unknown card id", () => {
    const deck: Deck = { cards: [card("1", "Animals")], folders: ["Animals"] };
    const next = removeCard(deck, "ghost");
    expect(next.cards.map((c) => c.id)).toEqual(["1"]);
  });
});

describe("removeFolder", () => {
  it("moves cards to the default folder and drops the folder", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      folders: ["Animals", "Objects"],
    };
    const next = removeFolder(deck, "Animals");
    expect(next.folders).toEqual(["Objects", DEFAULT_FOLDER]);
    expect(next.cards[0].folder).toBe(DEFAULT_FOLDER);
    expect(next.cards[1].folder).toBe("Objects");
  });

  it("keeps an existing default folder rather than duplicating it", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", DEFAULT_FOLDER)],
      folders: ["Animals", DEFAULT_FOLDER],
    };
    const next = removeFolder(deck, "Animals");
    expect(next.folders).toEqual([DEFAULT_FOLDER]);
    expect(next.cards[0].folder).toBe(DEFAULT_FOLDER);
  });

  it("removes an empty folder without touching cards", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals", "Phrases"],
    };
    const next = removeFolder(deck, "Phrases");
    expect(next.folders).toEqual(["Animals"]);
  });

  it("won't delete the default folder while it holds cards", () => {
    const deck: Deck = {
      cards: [card("1", DEFAULT_FOLDER)],
      folders: [DEFAULT_FOLDER],
    };
    expect(removeFolder(deck, DEFAULT_FOLDER)).toBe(deck);
  });
});

describe("moveCard", () => {
  it("changes a card's folder", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals")],
      folders: ["Animals", "Objects"],
    };
    const next = moveCard(deck, "1", "Objects");
    expect(next.cards[0].folder).toBe("Objects");
    expect(next.cards[1].folder).toBe("Animals");
    expect(next.folders).toEqual(["Animals", "Objects"]);
  });

  it("creates the target folder when it's new", () => {
    const deck: Deck = { cards: [card("1", "Animals")], folders: ["Animals"] };
    const next = moveCard(deck, "1", "Verbs");
    expect(next.folders).toEqual(["Animals", "Verbs"]);
    expect(next.cards[0].folder).toBe("Verbs");
  });
});
