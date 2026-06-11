import { describe, expect, it } from "vitest";
import { DEFAULT_FOLDER, type Flashcard } from "./flashcards";
import {
  addFolder,
  addFolderTag,
  appendCards,
  deckFromCards,
  folderCounts,
  foldersForTag,
  moveCard,
  removeFolder,
  removeFolderTag,
  renameFolder,
  tagColor,
  tagsForFolder,
  type Deck,
} from "./deck";

function card(id: string, folder: string): Flashcard {
  return { id, japanese: `j${id}`, english: `e${id}`, folder };
}

/** A deck literal with empty tag state, to keep the older tests terse. */
function deck(cards: Flashcard[], folders: string[]): Deck {
  return { cards, folders, tags: [], folderTags: {} };
}

const RED = "oklch(0.62 0.16 18)";
const BLUE = "oklch(0.55 0.12 255)";

describe("deckFromCards", () => {
  it("derives folders from the cards in first-seen order", () => {
    const result = deckFromCards([
      card("1", "Animals"),
      card("2", "Animals"),
      card("3", "Objects"),
    ]);
    expect(result.folders).toEqual(["Animals", "Objects"]);
    expect(result.tags).toEqual([]);
    expect(result.folderTags).toEqual({});
  });
});

describe("appendCards", () => {
  it("appends cards and keeps the existing cards and folders", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals", "Empty"],
      tags: [],
      folderTags: {},
    };
    const next = appendCards(base, [card("2", "Animals")]);
    expect(next.cards.map((c) => c.id)).toEqual(["1", "2"]);
    expect(next.folders).toEqual(["Animals", "Empty"]);
  });

  it("adds new folders the imported cards introduce, after the existing ones", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    const next = appendCards(base, [card("2", "Objects")]);
    expect(next.folders).toEqual(["Animals", "Objects"]);
  });

  it("reuses an existing folder matched case-insensitively", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    const next = appendCards(base, [card("2", "animals")]);
    expect(next.folders).toEqual(["Animals"]);
  });

  it("preserves existing tags and folder tags", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    const next = appendCards(base, [card("2", "Objects")]);
    expect(next.tags).toEqual([{ name: "JLPT", color: RED }]);
    expect(next.folderTags).toEqual({ Animals: ["JLPT"] });
  });
});

describe("folderCounts", () => {
  it("counts cards per folder and includes empty folders as zero", () => {
    const base = deck(
      [card("1", "Animals"), card("2", "Animals")],
      ["Animals", "Phrases"],
    );
    const counts = folderCounts(base);
    expect(counts.get("Animals")).toBe(2);
    expect(counts.get("Phrases")).toBe(0);
  });
});

describe("addFolder", () => {
  it("appends a new empty folder", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    const result = addFolder(base, "Phrases");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Animals", "Phrases"]);
    expect(result.deck.cards).toBe(base.cards);
  });

  it("trims the name", () => {
    const result = addFolder(deck([], []), "  Phrases  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Phrases"]);
  });

  it("rejects a blank name", () => {
    expect(addFolder(deck([], []), "   ").ok).toBe(false);
  });

  it("rejects a duplicate name case-insensitively", () => {
    const result = addFolder(deck([], ["Animals"]), "animals");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("already exists");
  });
});

describe("renameFolder", () => {
  it("renames the folder and relabels its cards", () => {
    const base = deck(
      [card("1", "Animals"), card("2", "Objects")],
      ["Animals", "Objects"],
    );
    const result = renameFolder(base, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Creatures", "Objects"]);
    expect(result.deck.cards[0].folder).toBe("Creatures");
    expect(result.deck.cards[1].folder).toBe("Objects");
  });

  it("allows a case-only rename", () => {
    const base = deck([card("1", "animals")], ["animals"]);
    const result = renameFolder(base, "animals", "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual(["Animals"]);
    expect(result.deck.cards[0].folder).toBe("Animals");
  });

  it("rejects renaming onto a different existing folder", () => {
    const base = deck([], ["Animals", "Objects"]);
    expect(renameFolder(base, "Animals", "objects").ok).toBe(false);
  });

  it("rejects a blank new name", () => {
    expect(renameFolder(deck([], ["Animals"]), "Animals", "  ").ok).toBe(false);
  });

  it("rejects renaming a folder that doesn't exist", () => {
    expect(renameFolder(deck([], ["Animals"]), "Ghost", "Phantom").ok).toBe(
      false,
    );
  });

  it("carries the folder's tags over to the new name", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    const result = renameFolder(base, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folderTags).toEqual({ Creatures: ["JLPT"] });
    expect(result.deck.tags).toEqual([{ name: "JLPT", color: RED }]);
  });
});

describe("removeFolder", () => {
  it("moves cards to the default folder and drops the folder", () => {
    const base = deck(
      [card("1", "Animals"), card("2", "Objects")],
      ["Animals", "Objects"],
    );
    const next = removeFolder(base, "Animals");
    expect(next.folders).toEqual(["Objects", DEFAULT_FOLDER]);
    expect(next.cards[0].folder).toBe(DEFAULT_FOLDER);
    expect(next.cards[1].folder).toBe("Objects");
  });

  it("keeps an existing default folder rather than duplicating it", () => {
    const base = deck(
      [card("1", "Animals"), card("2", DEFAULT_FOLDER)],
      ["Animals", DEFAULT_FOLDER],
    );
    const next = removeFolder(base, "Animals");
    expect(next.folders).toEqual([DEFAULT_FOLDER]);
    expect(next.cards[0].folder).toBe(DEFAULT_FOLDER);
  });

  it("removes an empty folder without touching cards", () => {
    const base = deck([card("1", "Animals")], ["Animals", "Phrases"]);
    const next = removeFolder(base, "Phrases");
    expect(next.folders).toEqual(["Animals"]);
  });

  it("won't delete the default folder while it holds cards", () => {
    const base = deck([card("1", DEFAULT_FOLDER)], [DEFAULT_FOLDER]);
    expect(removeFolder(base, DEFAULT_FOLDER)).toBe(base);
  });

  it("drops the folder's tags and prunes any left unused", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals", "Objects"],
      tags: [
        { name: "JLPT", color: RED },
        { name: "Hard", color: BLUE },
      ],
      folderTags: { Animals: ["JLPT"], Objects: ["Hard"] },
    };
    const next = removeFolder(base, "Objects");
    expect(next.folderTags).toEqual({ Animals: ["JLPT"] });
    expect(next.tags).toEqual([{ name: "JLPT", color: RED }]);
  });
});

describe("moveCard", () => {
  it("changes a card's folder", () => {
    const base = deck(
      [card("1", "Animals"), card("2", "Animals")],
      ["Animals", "Objects"],
    );
    const next = moveCard(base, "1", "Objects");
    expect(next.cards[0].folder).toBe("Objects");
    expect(next.cards[1].folder).toBe("Animals");
    expect(next.folders).toEqual(["Animals", "Objects"]);
  });

  it("creates the target folder when it's new", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    const next = moveCard(base, "1", "Verbs");
    expect(next.folders).toEqual(["Animals", "Verbs"]);
    expect(next.cards[0].folder).toBe("Verbs");
  });

  it("leaves tags untouched", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals", "Objects"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    const next = moveCard(base, "1", "Objects");
    expect(next.folderTags).toEqual({ Animals: ["JLPT"] });
  });
});

describe("addFolderTag", () => {
  it("creates a new tag with its color and pins it to the folder", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    const result = addFolderTag(base, "Animals", "JLPT", RED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.tags).toEqual([{ name: "JLPT", color: RED }]);
    expect(result.deck.folderTags).toEqual({ Animals: ["JLPT"] });
  });

  it("reuses an existing tag's spelling and color, ignoring the passed color", () => {
    const base: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      folders: ["Animals", "Objects"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    const result = addFolderTag(base, "Objects", "jlpt", BLUE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.tags).toEqual([{ name: "JLPT", color: RED }]);
    expect(result.deck.folderTags.Objects).toEqual(["JLPT"]);
  });

  it("is a no-op when the folder already has the tag", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    const result = addFolderTag(base, "Animals", "JLPT", BLUE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck).toBe(base);
  });

  it("rejects a blank tag name", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    expect(addFolderTag(base, "Animals", "  ", RED).ok).toBe(false);
  });

  it("rejects an unknown folder", () => {
    const base = deck([card("1", "Animals")], ["Animals"]);
    expect(addFolderTag(base, "Ghost", "JLPT", RED).ok).toBe(false);
  });
});

describe("removeFolderTag", () => {
  it("unpins a tag and prunes it when no folder keeps it", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    const next = removeFolderTag(base, "Animals", "JLPT");
    expect(next.folderTags).toEqual({});
    expect(next.tags).toEqual([]);
  });

  it("keeps a tag still pinned to another folder", () => {
    const base: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      folders: ["Animals", "Objects"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"], Objects: ["JLPT"] },
    };
    const next = removeFolderTag(base, "Animals", "JLPT");
    expect(next.folderTags).toEqual({ Objects: ["JLPT"] });
    expect(next.tags).toEqual([{ name: "JLPT", color: RED }]);
  });

  it("is a no-op for an unknown folder or tag", () => {
    const base: Deck = {
      cards: [card("1", "Animals")],
      folders: ["Animals"],
      tags: [{ name: "JLPT", color: RED }],
      folderTags: { Animals: ["JLPT"] },
    };
    expect(removeFolderTag(base, "Ghost", "JLPT")).toBe(base);
    expect(removeFolderTag(base, "Animals", "Nope")).toBe(base);
  });
});

describe("tag lookups", () => {
  const base: Deck = {
    cards: [card("1", "Animals"), card("2", "Objects")],
    folders: ["Animals", "Objects", "Phrases"],
    tags: [
      { name: "JLPT", color: RED },
      { name: "Hard", color: BLUE },
    ],
    folderTags: { Animals: ["JLPT", "Hard"], Objects: ["JLPT"] },
  };

  it("tagColor looks up case-insensitively", () => {
    expect(tagColor(base, "jlpt")).toBe(RED);
    expect(tagColor(base, "missing")).toBeUndefined();
  });

  it("tagsForFolder returns a folder's tags in order", () => {
    expect(tagsForFolder(base, "Animals")).toEqual(["JLPT", "Hard"]);
    expect(tagsForFolder(base, "Phrases")).toEqual([]);
  });

  it("foldersForTag returns matching folders in folder order", () => {
    expect(foldersForTag(base, "JLPT")).toEqual(["Animals", "Objects"]);
    expect(foldersForTag(base, "Hard")).toEqual(["Animals"]);
  });
});
