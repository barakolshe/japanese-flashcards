import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTION, type Flashcard } from "./flashcards";
import {
  addCard,
  addCollection,
  addFolder,
  appendCards,
  collectionCounts,
  deckFromCards,
  duplicateCollection,
  folderOfCollection,
  moveCard,
  moveCollection,
  removeCard,
  removeCollection,
  removeFolder,
  renameCollection,
  renameFolder,
  ungroupedCollections,
  type Deck,
} from "./deck";

function card(id: string, collection: string): Flashcard {
  return { id, japanese: `j${id}`, english: `e${id}`, collection };
}

describe("deckFromCards", () => {
  it("derives collections from the cards in first-seen order, no folders", () => {
    const deck = deckFromCards([
      card("1", "Animals"),
      card("2", "Animals"),
      card("3", "Objects"),
    ]);
    expect(deck.collections).toEqual(["Animals", "Objects"]);
    expect(deck.folders).toEqual([]);
  });
});

describe("appendCards", () => {
  it("appends cards and keeps the existing cards, collections, and folders", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals", "Empty"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const next = appendCards(deck, [card("2", "Animals")]);
    expect(next.cards.map((c) => c.id)).toEqual(["1", "2"]);
    expect(next.collections).toEqual(["Animals", "Empty"]);
    expect(next.folders).toEqual([{ name: "Nature", collections: ["Animals"] }]);
  });

  it("adds new collections the imported cards introduce, after the existing ones", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    const next = appendCards(deck, [card("2", "Objects")]);
    expect(next.collections).toEqual(["Animals", "Objects"]);
  });

  it("reuses an existing collection matched case-insensitively", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    const next = appendCards(deck, [card("2", "animals")]);
    expect(next.collections).toEqual(["Animals"]);
  });
});

describe("collectionCounts", () => {
  it("counts cards per collection and includes empty collections as zero", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals")],
      collections: ["Animals", "Phrases"],
      folders: [],
    };
    const counts = collectionCounts(deck);
    expect(counts.get("Animals")).toBe(2);
    expect(counts.get("Phrases")).toBe(0);
  });
});

describe("addCollection", () => {
  it("appends a new empty collection", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    const result = addCollection(deck, "Phrases");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Animals", "Phrases"]);
    expect(result.deck.cards).toBe(deck.cards);
  });

  it("trims the name", () => {
    const deck: Deck = { cards: [], collections: [], folders: [] };
    const result = addCollection(deck, "  Phrases  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Phrases"]);
  });

  it("rejects a blank name", () => {
    const result = addCollection(
      { cards: [], collections: [], folders: [] },
      "   ",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate name case-insensitively", () => {
    const deck: Deck = { cards: [], collections: ["Animals"], folders: [] };
    const result = addCollection(deck, "animals");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("already exists");
  });
});

describe("renameCollection", () => {
  it("renames the collection and relabels its cards", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      collections: ["Animals", "Objects"],
      folders: [],
    };
    const result = renameCollection(deck, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Creatures", "Objects"]);
    expect(result.deck.cards[0].collection).toBe("Creatures");
    expect(result.deck.cards[1].collection).toBe("Objects");
  });

  it("relabels the collection inside any folder it's filed under", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const result = renameCollection(deck, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([
      { name: "Nature", collections: ["Creatures"] },
    ]);
  });

  it("allows a case-only rename", () => {
    const deck: Deck = {
      cards: [card("1", "animals")],
      collections: ["animals"],
      folders: [],
    };
    const result = renameCollection(deck, "animals", "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Animals"]);
    expect(result.deck.cards[0].collection).toBe("Animals");
  });

  it("rejects renaming onto a different existing collection", () => {
    const deck: Deck = {
      cards: [],
      collections: ["Animals", "Objects"],
      folders: [],
    };
    const result = renameCollection(deck, "Animals", "objects");
    expect(result.ok).toBe(false);
  });

  it("rejects a blank new name", () => {
    const deck: Deck = { cards: [], collections: ["Animals"], folders: [] };
    expect(renameCollection(deck, "Animals", "  ").ok).toBe(false);
  });

  it("rejects renaming a collection that doesn't exist", () => {
    const deck: Deck = { cards: [], collections: ["Animals"], folders: [] };
    expect(renameCollection(deck, "Ghost", "Phantom").ok).toBe(false);
  });
});

describe("removeCollection", () => {
  it("moves cards to the default collection and drops the collection", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      collections: ["Animals", "Objects"],
      folders: [],
    };
    const next = removeCollection(deck, "Animals");
    expect(next.collections).toEqual(["Objects", DEFAULT_COLLECTION]);
    expect(next.cards[0].collection).toBe(DEFAULT_COLLECTION);
    expect(next.cards[1].collection).toBe("Objects");
  });

  it("also removes the collection from any folder it was filed under", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const next = removeCollection(deck, "Animals");
    expect(next.folders).toEqual([{ name: "Nature", collections: [] }]);
  });

  it("keeps an existing default collection rather than duplicating it", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", DEFAULT_COLLECTION)],
      collections: ["Animals", DEFAULT_COLLECTION],
      folders: [],
    };
    const next = removeCollection(deck, "Animals");
    expect(next.collections).toEqual([DEFAULT_COLLECTION]);
    expect(next.cards[0].collection).toBe(DEFAULT_COLLECTION);
  });

  it("removes an empty collection without touching cards", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals", "Phrases"],
      folders: [],
    };
    const next = removeCollection(deck, "Phrases");
    expect(next.collections).toEqual(["Animals"]);
  });

  it("won't delete the default collection while it holds cards", () => {
    const deck: Deck = {
      cards: [card("1", DEFAULT_COLLECTION)],
      collections: [DEFAULT_COLLECTION],
      folders: [],
    };
    expect(removeCollection(deck, DEFAULT_COLLECTION)).toBe(deck);
  });
});

describe("moveCard", () => {
  it("changes a card's collection", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals")],
      collections: ["Animals", "Objects"],
      folders: [],
    };
    const next = moveCard(deck, "1", "Objects");
    expect(next.cards[0].collection).toBe("Objects");
    expect(next.cards[1].collection).toBe("Animals");
    expect(next.collections).toEqual(["Animals", "Objects"]);
  });

  it("creates the target collection when it's new", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    const next = moveCard(deck, "1", "Verbs");
    expect(next.collections).toEqual(["Animals", "Verbs"]);
    expect(next.cards[0].collection).toBe("Verbs");
  });
});

describe("duplicateCollection", () => {
  it("copies the collection and its cards into a '<name> copy' collection", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals"), card("3", "Objects")],
      collections: ["Animals", "Objects"],
      folders: [],
    };
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Animals copy");
    // Inserted right after the source collection.
    expect(result.deck.collections).toEqual([
      "Animals",
      "Animals copy",
      "Objects",
    ]);
    const copies = result.deck.cards.filter(
      (c) => c.collection === "Animals copy",
    );
    expect(copies).toHaveLength(2);
    expect(copies.map((c) => c.japanese)).toEqual(["j1", "j2"]);
  });

  it("gives the copies fresh ids and leaves the originals untouched", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.deck.cards.find((c) => c.collection === "Animals copy");
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe("1");
    expect(result.deck.cards[0]).toEqual(card("1", "Animals"));
  });

  it("files the copy in the same folder as the source, right after it", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([
      { name: "Nature", collections: ["Animals", "Animals copy"] },
    ]);
  });

  it("deduplicates the copy name when one already exists", () => {
    const deck: Deck = {
      cards: [],
      collections: ["Animals", "Animals copy"],
      folders: [],
    };
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Animals copy 2");
  });

  it("rejects duplicating a collection that doesn't exist", () => {
    const deck: Deck = { cards: [], collections: ["Animals"], folders: [] };
    expect(duplicateCollection(deck, "Ghost").ok).toBe(false);
  });
});

describe("addCard", () => {
  it("adds a card to an existing collection", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    const result = addCard(deck, "猫", "cat", "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toHaveLength(2);
    expect(result.deck.cards[1]).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
    });
    expect(result.deck.collections).toEqual(["Animals"]);
  });

  it("trims the text and creates the target collection when it's new", () => {
    const deck: Deck = { cards: [], collections: [], folders: [] };
    const result = addCard(deck, "  犬  ", "  dog  ", "Verbs");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards[0]).toMatchObject({ japanese: "犬", english: "dog" });
    expect(result.deck.collections).toEqual(["Verbs"]);
  });

  it("rejects a blank Japanese or English value", () => {
    const deck: Deck = { cards: [], collections: ["Animals"], folders: [] };
    expect(addCard(deck, "", "cat", "Animals").ok).toBe(false);
    expect(addCard(deck, "猫", "   ", "Animals").ok).toBe(false);
  });
});

describe("removeCard", () => {
  it("removes the card and keeps the collections and folders", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Animals")],
      collections: ["Animals", "Objects"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const next = removeCard(deck, "1");
    expect(next.cards.map((c) => c.id)).toEqual(["2"]);
    expect(next.collections).toEqual(["Animals", "Objects"]);
    expect(next.folders).toEqual([{ name: "Nature", collections: ["Animals"] }]);
  });

  it("is a no-op for an unknown card id", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
    };
    expect(removeCard(deck, "ghost").cards.map((c) => c.id)).toEqual(["1"]);
  });
});

describe("addFolder", () => {
  it("appends a new empty folder", () => {
    const deck: Deck = { cards: [], collections: [], folders: [] };
    const result = addFolder(deck, "Nature");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([{ name: "Nature", collections: [] }]);
  });

  it("trims the name and rejects blanks and case-insensitive duplicates", () => {
    const deck: Deck = {
      cards: [],
      collections: [],
      folders: [{ name: "Nature", collections: [] }],
    };
    const trimmed = addFolder(
      { cards: [], collections: [], folders: [] },
      "  Nature  ",
    );
    expect(trimmed.ok).toBe(true);
    if (trimmed.ok) {
      expect(trimmed.deck.folders[0].name).toBe("Nature");
    }
    expect(addFolder(deck, "  ").ok).toBe(false);
    expect(addFolder(deck, "nature").ok).toBe(false);
  });
});

describe("renameFolder", () => {
  it("renames the folder, keeping its collections", () => {
    const deck: Deck = {
      cards: [],
      collections: ["Animals"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const result = renameFolder(deck, "Nature", "Wildlife");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([
      { name: "Wildlife", collections: ["Animals"] },
    ]);
  });

  it("rejects renaming onto another folder, blanks, and missing folders", () => {
    const deck: Deck = {
      cards: [],
      collections: [],
      folders: [
        { name: "Nature", collections: [] },
        { name: "Objects", collections: [] },
      ],
    };
    expect(renameFolder(deck, "Nature", "objects").ok).toBe(false);
    expect(renameFolder(deck, "Nature", "  ").ok).toBe(false);
    expect(renameFolder(deck, "Ghost", "Phantom").ok).toBe(false);
  });
});

describe("removeFolder", () => {
  it("drops the folder and leaves its collections ungrouped, cards untouched", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [{ name: "Nature", collections: ["Animals"] }],
    };
    const next = removeFolder(deck, "Nature");
    expect(next.folders).toEqual([]);
    expect(next.collections).toEqual(["Animals"]);
    expect(next.cards).toEqual(deck.cards);
  });
});

describe("moveCollection", () => {
  const base: Deck = {
    cards: [card("1", "Animals"), card("2", "Plants")],
    collections: ["Animals", "Plants"],
    folders: [
      { name: "Nature", collections: ["Animals"] },
      { name: "Misc", collections: [] },
    ],
  };

  it("files an ungrouped collection under a folder", () => {
    const next = moveCollection(base, "Plants", "Nature");
    expect(next.folders).toEqual([
      { name: "Nature", collections: ["Animals", "Plants"] },
      { name: "Misc", collections: [] },
    ]);
  });

  it("moves a collection from one folder to another (only one folder at a time)", () => {
    const next = moveCollection(base, "Animals", "Misc");
    expect(next.folders).toEqual([
      { name: "Nature", collections: [] },
      { name: "Misc", collections: ["Animals"] },
    ]);
  });

  it("ungroups a collection when the target folder is null", () => {
    const next = moveCollection(base, "Animals", null);
    expect(next.folders).toEqual([
      { name: "Nature", collections: [] },
      { name: "Misc", collections: [] },
    ]);
  });

  it("leaves the collection ungrouped when the target folder doesn't exist", () => {
    const next = moveCollection(base, "Animals", "Ghost");
    expect(next.folders).toEqual([
      { name: "Nature", collections: [] },
      { name: "Misc", collections: [] },
    ]);
  });
});

describe("ungroupedCollections / folderOfCollection", () => {
  const deck: Deck = {
    cards: [],
    collections: ["Animals", "Plants", "Phrases"],
    folders: [{ name: "Nature", collections: ["Animals", "Plants"] }],
  };

  it("lists collections not filed in any folder, in collections order", () => {
    expect(ungroupedCollections(deck)).toEqual(["Phrases"]);
  });

  it("reports the folder a collection is filed under, or null", () => {
    expect(folderOfCollection(deck, "Animals")).toBe("Nature");
    expect(folderOfCollection(deck, "Phrases")).toBeNull();
  });
});
