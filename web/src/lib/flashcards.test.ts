import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTION,
  collectionNames,
  createCard,
  parseFlashcardsCsv,
  serializeFlashcardsCsv,
} from "./flashcards";

describe("createCard", () => {
  it("builds a card from the given fields with a fresh unique id", () => {
    const a = createCard("猫", "cat", "Animals");
    const b = createCard("猫", "cat", "Animals");
    expect(a).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
    });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it("keeps a trimmed pronunciation when one is given", () => {
    const card = createCard("猫", "cat", "Animals", "  neko  ");
    expect(card.pronunciation).toBe("neko");
  });

  it("omits the pronunciation key when absent or blank", () => {
    expect(createCard("猫", "cat", "Animals")).not.toHaveProperty(
      "pronunciation",
    );
    expect(createCard("猫", "cat", "Animals", "   ")).not.toHaveProperty(
      "pronunciation",
    );
  });
});

describe("parseFlashcardsCsv", () => {
  it("parses well-formed rows into cards", () => {
    const csv = [
      "japanese,english,collection",
      "猫,cat,Animals",
      "犬,dog,Animals",
      "ありがとう,thank you,Phrases",
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([]);
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
    });
    expect(result.cards[0].id).toBeTruthy();
  });

  it("matches headers case-insensitively and order-independently", () => {
    const csv = ["English, Collection , JAPANESE", "cat,Animals,猫"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
    });
  });

  it("defaults a blank or missing collection to the default collection", () => {
    const csv = [
      "japanese,english,collection",
      "猫,cat,",
      "犬,dog,Animals",
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].collection).toBe(DEFAULT_COLLECTION);
    expect(result.cards[1].collection).toBe("Animals");
  });

  it("reads a pronunciation column when the header names one", () => {
    const csv = [
      "japanese,english,collection,pronunciation",
      "猫,cat,Animals,neko",
      "犬,dog,Animals,",
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].pronunciation).toBe("neko");
    // A blank pronunciation cell leaves the key off rather than storing "".
    expect(result.cards[1]).not.toHaveProperty("pronunciation");
  });

  it("reads pronunciation positionally as the fourth column", () => {
    const csv = ["猫,cat,Animals,neko"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
      pronunciation: "neko",
    });
  });

  it("works without a collection column at all", () => {
    const csv = ["japanese,english", "猫,cat"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].collection).toBe(DEFAULT_COLLECTION);
  });

  it("ignores a legacy folder header rather than treating it as the collection", () => {
    const csv = ["japanese,english,folder", "猫,cat,Animals"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // "folder" isn't a recognized column, so the third value is dropped and the
    // card lands in the default collection.
    expect(result.cards[0].collection).toBe(DEFAULT_COLLECTION);
  });

  it("trims surrounding whitespace from values", () => {
    const csv = [
      "japanese,english,collection",
      "  猫  ,  cat  ,  Animals  ",
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
    });
  });

  it("handles quoted fields containing commas", () => {
    const csv = [
      "japanese,english,collection",
      '行ってきます,"I\'m off, see you",Phrases',
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].english).toBe("I'm off, see you");
  });

  it("skips rows missing Japanese or English and reports them", () => {
    const csv = [
      "japanese,english,collection",
      "猫,cat,Animals",
      ",orphan,Animals",
      "犬,,Animals",
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toHaveLength(1);
    expect(result.skipped).toEqual([
      { line: 3, reason: "missing Japanese" },
      { line: 4, reason: "missing English" },
    ]);
  });

  it("reads a file with no header row positionally", () => {
    const csv = ["猫,cat,Animals", "犬,dog,Animals"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      collection: "Animals",
    });
  });

  it("reads a headerless file without a collection column", () => {
    const csv = ["猫,cat", "犬,dog"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].collection).toBe(DEFAULT_COLLECTION);
  });

  it("numbers lines from 1 when there is no header row", () => {
    const csv = ["猫,cat", ",orphan", "犬,dog"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toHaveLength(2);
    expect(result.skipped).toEqual([{ line: 2, reason: "missing Japanese" }]);
  });

  it("treats a header naming only one column as data, not a header", () => {
    const csv = ["japanese,collection", "猫,Animals"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0]).toMatchObject({
      japanese: "japanese",
      english: "collection",
    });
  });

  it("fails on a header-only file", () => {
    const result = parseFlashcardsCsv("japanese,english,collection\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no card rows");
  });

  it("fails on an empty file", () => {
    const result = parseFlashcardsCsv("");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("empty");
  });

  it("fails when every row is invalid", () => {
    const csv = ["japanese,english", ",", ","].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(false);
  });
});

describe("serializeFlashcardsCsv", () => {
  it("writes a header and one row per card", () => {
    const csv = serializeFlashcardsCsv([
      { id: "1", japanese: "猫", english: "cat", collection: "Animals" },
      {
        id: "2",
        japanese: "犬",
        english: "dog",
        collection: "Animals",
        pronunciation: "inu",
      },
    ]);

    expect(csv).toBe(
      [
        "japanese,english,collection,pronunciation",
        // A card with no pronunciation leaves that cell empty.
        "猫,cat,Animals,",
        "犬,dog,Animals,inu",
      ].join("\n"),
    );
  });

  it("quotes values containing commas", () => {
    const csv = serializeFlashcardsCsv([
      {
        id: "1",
        japanese: "行ってきます",
        english: "I'm off, see you",
        collection: "Phrases",
      },
    ]);

    expect(csv).toContain('"I\'m off, see you"');
  });

  it("round-trips through the parser unchanged", () => {
    const cards = [
      {
        id: "1",
        japanese: "猫",
        english: "cat",
        collection: "Animals",
        pronunciation: "neko",
      },
      {
        id: "2",
        japanese: "行ってきます",
        english: "I'm off, see you",
        collection: "Phrases",
      },
      { id: "3", japanese: "本", english: "book", collection: DEFAULT_COLLECTION },
    ];

    const result = parseFlashcardsCsv(serializeFlashcardsCsv(cards));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([]);
    expect(
      result.cards.map(({ japanese, english, collection, pronunciation }) => ({
        japanese,
        english,
        collection,
        pronunciation,
      })),
    ).toEqual(
      cards.map(({ japanese, english, collection, pronunciation }) => ({
        japanese,
        english,
        collection,
        pronunciation,
      })),
    );
  });

  it("produces an empty deck as a header-only file", () => {
    expect(serializeFlashcardsCsv([])).toBe(
      "japanese,english,collection,pronunciation",
    );
  });
});

describe("collectionNames", () => {
  it("returns distinct collections in first-seen order", () => {
    const cards = [
      { id: "1", japanese: "猫", english: "cat", collection: "Animals" },
      { id: "2", japanese: "犬", english: "dog", collection: "Animals" },
      { id: "3", japanese: "本", english: "book", collection: "Objects" },
    ];

    expect(collectionNames(cards)).toEqual(["Animals", "Objects"]);
  });
});
