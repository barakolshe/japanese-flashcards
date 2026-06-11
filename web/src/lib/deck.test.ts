import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTION, type Flashcard } from "./flashcards";
import {
  addCard,
  addCollection,
  addCollectionTag,
  addFolder,
  appendCards,
  collectionCounts,
  collectionsForTag,
  deckFromCards,
  duplicateCollection,
  folderOfCollection,
  moveCard,
  moveCollection,
  removeCard,
  removeCollection,
  removeCollectionTag,
  removeFolder,
  renameCollection,
  renameFolder,
  tagColor,
  tagsForCollection,
  ungroupedCollections,
  type Deck,
  type Folder,
} from "./deck";

function card(id: string, collection: string): Flashcard {
  return { id, japanese: `j${id}`, english: `e${id}`, collection };
}

/** A deck literal with empty tag state, to keep the model tests terse. */
function mk(cards: Flashcard[], collections: string[], folders: Folder[]): Deck {
  return { cards, collections, folders, tags: [], collectionTags: {} };
}

const RED = "oklch(0.62 0.16 18)";
const BLUE = "oklch(0.55 0.12 255)";

describe("deckFromCards", () => {
  it("derives collections from the cards in first-seen order, no folders", () => {
    const deck = deckFromCards([
      card("1", "Animals"),
      card("2", "Animals"),
      card("3", "Objects"),
    ]);
    expect(deck.collections).toEqual(["Animals", "Objects"]);
    expect(deck.folders).toEqual([]);
    expect(deck.tags).toEqual([]);
    expect(deck.collectionTags).toEqual({});
  });
});

describe("appendCards", () => {
  it("appends cards and keeps the existing cards, collections, and folders", () => {
    const deck = mk([card("1", "Animals")], ["Animals", "Empty"], [
      { name: "Nature", collections: ["Animals"] },
    ]);
    const next = appendCards(deck, [card("2", "Animals")]);
    expect(next.cards.map((c) => c.id)).toEqual(["1", "2"]);
    expect(next.collections).toEqual(["Animals", "Empty"]);
    expect(next.folders).toEqual([{ name: "Nature", collections: ["Animals"] }]);
  });

  it("adds new collections the imported cards introduce, after the existing ones", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    const next = appendCards(deck, [card("2", "Objects")]);
    expect(next.collections).toEqual(["Animals", "Objects"]);
  });

  it("reuses an existing collection matched case-insensitively", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    const next = appendCards(deck, [card("2", "animals")]);
    expect(next.collections).toEqual(["Animals"]);
  });

  it("preserves existing tags and collection tags", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    const next = appendCards(deck, [card("2", "Objects")]);
    expect(next.tags).toEqual([{ name: "JLPT", color: RED }]);
    expect(next.collectionTags).toEqual({ Animals: ["JLPT"] });
  });
});

describe("collectionCounts", () => {
  it("counts cards per collection and includes empty collections as zero", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", "Animals")],
      ["Animals", "Phrases"],
      [],
    );
    const counts = collectionCounts(deck);
    expect(counts.get("Animals")).toBe(2);
    expect(counts.get("Phrases")).toBe(0);
  });
});

describe("addCollection", () => {
  it("appends a new empty collection", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    const result = addCollection(deck, "Phrases");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Animals", "Phrases"]);
    expect(result.deck.cards).toBe(deck.cards);
  });

  it("trims the name", () => {
    const result = addCollection(mk([], [], []), "  Phrases  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Phrases"]);
  });

  it("rejects a blank name", () => {
    expect(addCollection(mk([], [], []), "   ").ok).toBe(false);
  });

  it("rejects a duplicate name case-insensitively", () => {
    const result = addCollection(mk([], ["Animals"], []), "animals");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("already exists");
  });
});

describe("renameCollection", () => {
  it("renames the collection and relabels its cards", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", "Objects")],
      ["Animals", "Objects"],
      [],
    );
    const result = renameCollection(deck, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Creatures", "Objects"]);
    expect(result.deck.cards[0].collection).toBe("Creatures");
    expect(result.deck.cards[1].collection).toBe("Objects");
  });

  it("relabels the collection inside any folder it's filed under", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], [
      { name: "Nature", collections: ["Animals"] },
    ]);
    const result = renameCollection(deck, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([
      { name: "Nature", collections: ["Creatures"] },
    ]);
  });

  it("allows a case-only rename", () => {
    const deck = mk([card("1", "animals")], ["animals"], []);
    const result = renameCollection(deck, "animals", "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collections).toEqual(["Animals"]);
    expect(result.deck.cards[0].collection).toBe("Animals");
  });

  it("rejects renaming onto a different existing collection", () => {
    const deck = mk([], ["Animals", "Objects"], []);
    expect(renameCollection(deck, "Animals", "objects").ok).toBe(false);
  });

  it("rejects a blank new name", () => {
    expect(renameCollection(mk([], ["Animals"], []), "Animals", "  ").ok).toBe(
      false,
    );
  });

  it("rejects renaming a collection that doesn't exist", () => {
    expect(renameCollection(mk([], ["Animals"], []), "Ghost", "Phantom").ok).toBe(
      false,
    );
  });

  it("carries the collection's tags over to the new name", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    const result = renameCollection(deck, "Animals", "Creatures");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collectionTags).toEqual({ Creatures: ["JLPT"] });
    expect(result.deck.tags).toEqual([{ name: "JLPT", color: RED }]);
  });
});

describe("removeCollection", () => {
  it("moves cards to the default collection and drops the collection", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", "Objects")],
      ["Animals", "Objects"],
      [],
    );
    const next = removeCollection(deck, "Animals");
    expect(next.collections).toEqual(["Objects", DEFAULT_COLLECTION]);
    expect(next.cards[0].collection).toBe(DEFAULT_COLLECTION);
    expect(next.cards[1].collection).toBe("Objects");
  });

  it("also removes the collection from any folder it was filed under", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], [
      { name: "Nature", collections: ["Animals"] },
    ]);
    const next = removeCollection(deck, "Animals");
    expect(next.folders).toEqual([{ name: "Nature", collections: [] }]);
  });

  it("keeps an existing default collection rather than duplicating it", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", DEFAULT_COLLECTION)],
      ["Animals", DEFAULT_COLLECTION],
      [],
    );
    const next = removeCollection(deck, "Animals");
    expect(next.collections).toEqual([DEFAULT_COLLECTION]);
    expect(next.cards[0].collection).toBe(DEFAULT_COLLECTION);
  });

  it("removes an empty collection without touching cards", () => {
    const deck = mk([card("1", "Animals")], ["Animals", "Phrases"], []);
    const next = removeCollection(deck, "Phrases");
    expect(next.collections).toEqual(["Animals"]);
  });

  it("won't delete the default collection while it holds cards", () => {
    const deck = mk([card("1", DEFAULT_COLLECTION)], [DEFAULT_COLLECTION], []);
    expect(removeCollection(deck, DEFAULT_COLLECTION)).toBe(deck);
  });

  it("drops the collection's tags and prunes any left unused", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals", "Objects"],
      folders: [],
      tags: [
        { name: "JLPT", color: RED },
        { name: "Hard", color: BLUE },
      ],
      collectionTags: { Animals: ["JLPT"], Objects: ["Hard"] },
    };
    const next = removeCollection(deck, "Objects");
    expect(next.collectionTags).toEqual({ Animals: ["JLPT"] });
    expect(next.tags).toEqual([{ name: "JLPT", color: RED }]);
  });
});

describe("moveCard", () => {
  it("changes a card's collection", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", "Animals")],
      ["Animals", "Objects"],
      [],
    );
    const next = moveCard(deck, "1", "Objects");
    expect(next.cards[0].collection).toBe("Objects");
    expect(next.cards[1].collection).toBe("Animals");
    expect(next.collections).toEqual(["Animals", "Objects"]);
  });

  it("creates the target collection when it's new", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    const next = moveCard(deck, "1", "Verbs");
    expect(next.collections).toEqual(["Animals", "Verbs"]);
    expect(next.cards[0].collection).toBe("Verbs");
  });
});

describe("duplicateCollection", () => {
  it("copies the collection and its cards into a '<name> copy' collection", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", "Animals"), card("3", "Objects")],
      ["Animals", "Objects"],
      [],
    );
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Animals copy");
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
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.deck.cards.find((c) => c.collection === "Animals copy");
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe("1");
    expect(result.deck.cards[0]).toEqual(card("1", "Animals"));
  });

  it("files the copy in the same folder as the source, right after it", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], [
      { name: "Nature", collections: ["Animals"] },
    ]);
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([
      { name: "Nature", collections: ["Animals", "Animals copy"] },
    ]);
  });

  it("deduplicates the copy name when one already exists", () => {
    const deck = mk([], ["Animals", "Animals copy"], []);
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Animals copy 2");
  });

  it("rejects duplicating a collection that doesn't exist", () => {
    expect(duplicateCollection(mk([], ["Animals"], []), "Ghost").ok).toBe(false);
  });

  it("gives the copy its own set of the source collection's tags", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    const result = duplicateCollection(deck, "Animals");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.collectionTags["Animals copy"]).toEqual(["JLPT"]);
    expect(result.deck.collectionTags["Animals copy"]).not.toBe(
      deck.collectionTags.Animals,
    );
  });
});

describe("addCard", () => {
  it("adds a card to an existing collection", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
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
    const result = addCard(mk([], [], []), "  犬  ", "  dog  ", "Verbs");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards[0]).toMatchObject({ japanese: "犬", english: "dog" });
    expect(result.deck.collections).toEqual(["Verbs"]);
  });

  it("rejects a blank Japanese or English value", () => {
    const deck = mk([], ["Animals"], []);
    expect(addCard(deck, "", "cat", "Animals").ok).toBe(false);
    expect(addCard(deck, "猫", "   ", "Animals").ok).toBe(false);
  });
});

describe("removeCard", () => {
  it("removes the card and keeps the collections and folders", () => {
    const deck = mk(
      [card("1", "Animals"), card("2", "Animals")],
      ["Animals", "Objects"],
      [{ name: "Nature", collections: ["Animals"] }],
    );
    const next = removeCard(deck, "1");
    expect(next.cards.map((c) => c.id)).toEqual(["2"]);
    expect(next.collections).toEqual(["Animals", "Objects"]);
    expect(next.folders).toEqual([{ name: "Nature", collections: ["Animals"] }]);
  });

  it("is a no-op for an unknown card id", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    expect(removeCard(deck, "ghost").cards.map((c) => c.id)).toEqual(["1"]);
  });
});

describe("addFolder", () => {
  it("appends a new empty folder", () => {
    const result = addFolder(mk([], [], []), "Nature");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([{ name: "Nature", collections: [] }]);
  });

  it("trims the name and rejects blanks and case-insensitive duplicates", () => {
    const deck = mk([], [], [{ name: "Nature", collections: [] }]);
    const trimmed = addFolder(mk([], [], []), "  Nature  ");
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
    const deck = mk([], ["Animals"], [{ name: "Nature", collections: ["Animals"] }]);
    const result = renameFolder(deck, "Nature", "Wildlife");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.folders).toEqual([
      { name: "Wildlife", collections: ["Animals"] },
    ]);
  });

  it("rejects renaming onto another folder, blanks, and missing folders", () => {
    const deck = mk([], [], [
      { name: "Nature", collections: [] },
      { name: "Objects", collections: [] },
    ]);
    expect(renameFolder(deck, "Nature", "objects").ok).toBe(false);
    expect(renameFolder(deck, "Nature", "  ").ok).toBe(false);
    expect(renameFolder(deck, "Ghost", "Phantom").ok).toBe(false);
  });
});

describe("removeFolder", () => {
  it("drops the folder and leaves its collections ungrouped, cards untouched", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], [
      { name: "Nature", collections: ["Animals"] },
    ]);
    const next = removeFolder(deck, "Nature");
    expect(next.folders).toEqual([]);
    expect(next.collections).toEqual(["Animals"]);
    expect(next.cards).toEqual(deck.cards);
  });
});

describe("moveCollection", () => {
  const base = mk(
    [card("1", "Animals"), card("2", "Plants")],
    ["Animals", "Plants"],
    [
      { name: "Nature", collections: ["Animals"] },
      { name: "Misc", collections: [] },
    ],
  );

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
  const deck = mk([], ["Animals", "Plants", "Phrases"], [
    { name: "Nature", collections: ["Animals", "Plants"] },
  ]);

  it("lists collections not filed in any folder, in collections order", () => {
    expect(ungroupedCollections(deck)).toEqual(["Phrases"]);
  });

  it("reports the folder a collection is filed under, or null", () => {
    expect(folderOfCollection(deck, "Animals")).toBe("Nature");
    expect(folderOfCollection(deck, "Phrases")).toBeNull();
  });
});

describe("addCollectionTag", () => {
  it("creates a new tag with its color and pins it to the collection", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    const result = addCollectionTag(deck, "Animals", "JLPT", RED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.tags).toEqual([{ name: "JLPT", color: RED }]);
    expect(result.deck.collectionTags).toEqual({ Animals: ["JLPT"] });
  });

  it("reuses an existing tag's spelling and color, ignoring the passed color", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      collections: ["Animals", "Objects"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    const result = addCollectionTag(deck, "Objects", "jlpt", BLUE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.tags).toEqual([{ name: "JLPT", color: RED }]);
    expect(result.deck.collectionTags.Objects).toEqual(["JLPT"]);
  });

  it("is a no-op when the collection already has the tag", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    const result = addCollectionTag(deck, "Animals", "JLPT", BLUE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck).toBe(deck);
  });

  it("rejects a blank tag name", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    expect(addCollectionTag(deck, "Animals", "  ", RED).ok).toBe(false);
  });

  it("rejects an unknown collection", () => {
    const deck = mk([card("1", "Animals")], ["Animals"], []);
    expect(addCollectionTag(deck, "Ghost", "JLPT", RED).ok).toBe(false);
  });
});

describe("removeCollectionTag", () => {
  it("unpins a tag and prunes it when no collection keeps it", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    const next = removeCollectionTag(deck, "Animals", "JLPT");
    expect(next.collectionTags).toEqual({});
    expect(next.tags).toEqual([]);
  });

  it("keeps a tag still pinned to another collection", () => {
    const deck: Deck = {
      cards: [card("1", "Animals"), card("2", "Objects")],
      collections: ["Animals", "Objects"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"], Objects: ["JLPT"] },
    };
    const next = removeCollectionTag(deck, "Animals", "JLPT");
    expect(next.collectionTags).toEqual({ Objects: ["JLPT"] });
    expect(next.tags).toEqual([{ name: "JLPT", color: RED }]);
  });

  it("is a no-op for an unknown collection or tag", () => {
    const deck: Deck = {
      cards: [card("1", "Animals")],
      collections: ["Animals"],
      folders: [],
      tags: [{ name: "JLPT", color: RED }],
      collectionTags: { Animals: ["JLPT"] },
    };
    expect(removeCollectionTag(deck, "Ghost", "JLPT")).toBe(deck);
    expect(removeCollectionTag(deck, "Animals", "Nope")).toBe(deck);
  });
});

describe("tag lookups", () => {
  const deck: Deck = {
    cards: [card("1", "Animals"), card("2", "Objects")],
    collections: ["Animals", "Objects", "Phrases"],
    folders: [],
    tags: [
      { name: "JLPT", color: RED },
      { name: "Hard", color: BLUE },
    ],
    collectionTags: { Animals: ["JLPT", "Hard"], Objects: ["JLPT"] },
  };

  it("tagColor looks up case-insensitively", () => {
    expect(tagColor(deck, "jlpt")).toBe(RED);
    expect(tagColor(deck, "missing")).toBeUndefined();
  });

  it("tagsForCollection returns a collection's tags in order", () => {
    expect(tagsForCollection(deck, "Animals")).toEqual(["JLPT", "Hard"]);
    expect(tagsForCollection(deck, "Phrases")).toEqual([]);
  });

  it("collectionsForTag returns matching collections in collection order", () => {
    expect(collectionsForTag(deck, "JLPT")).toEqual(["Animals", "Objects"]);
    expect(collectionsForTag(deck, "Hard")).toEqual(["Animals"]);
  });
});
