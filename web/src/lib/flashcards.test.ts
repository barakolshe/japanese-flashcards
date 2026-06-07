import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOLDER,
  folderNames,
  parseFlashcardsCsv,
  serializeFlashcardsCsv,
} from "./flashcards";

describe("parseFlashcardsCsv", () => {
  it("parses well-formed rows into cards", () => {
    const csv = [
      "japanese,english,folder",
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
      folder: "Animals",
    });
    expect(result.cards[0].id).toBeTruthy();
  });

  it("matches headers case-insensitively and order-independently", () => {
    const csv = ["English, Folder , JAPANESE", "cat,Animals,猫"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      folder: "Animals",
    });
  });

  it("defaults a blank or missing folder to the default folder", () => {
    const csv = [
      "japanese,english,folder",
      "猫,cat,",
      "犬,dog,Animals",
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].folder).toBe(DEFAULT_FOLDER);
    expect(result.cards[1].folder).toBe("Animals");
  });

  it("works without a folder column at all", () => {
    const csv = ["japanese,english", "猫,cat"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].folder).toBe(DEFAULT_FOLDER);
  });

  it("trims surrounding whitespace from values", () => {
    const csv = ["japanese,english,folder", "  猫  ,  cat  ,  Animals  "].join(
      "\n",
    );

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0]).toMatchObject({
      japanese: "猫",
      english: "cat",
      folder: "Animals",
    });
  });

  it("handles quoted fields containing commas", () => {
    const csv = [
      "japanese,english,folder",
      '行ってきます,"I\'m off, see you",Phrases',
    ].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].english).toBe("I'm off, see you");
  });

  it("skips rows missing Japanese or English and reports them", () => {
    const csv = [
      "japanese,english,folder",
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

  it("fails when a required column is missing", () => {
    const csv = ["japanese,folder", "猫,Animals"].join("\n");

    const result = parseFlashcardsCsv(csv);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("english");
  });

  it("fails on a header-only file", () => {
    const result = parseFlashcardsCsv("japanese,english,folder\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no card rows");
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
      { id: "1", japanese: "猫", english: "cat", folder: "Animals" },
      { id: "2", japanese: "犬", english: "dog", folder: "Animals" },
    ]);

    expect(csv).toBe(
      ["japanese,english,folder", "猫,cat,Animals", "犬,dog,Animals"].join("\n"),
    );
  });

  it("quotes values containing commas", () => {
    const csv = serializeFlashcardsCsv([
      { id: "1", japanese: "行ってきます", english: "I'm off, see you", folder: "Phrases" },
    ]);

    expect(csv).toContain('"I\'m off, see you"');
  });

  it("round-trips through the parser unchanged", () => {
    const cards = [
      { id: "1", japanese: "猫", english: "cat", folder: "Animals" },
      { id: "2", japanese: "行ってきます", english: "I'm off, see you", folder: "Phrases" },
      { id: "3", japanese: "本", english: "book", folder: DEFAULT_FOLDER },
    ];

    const result = parseFlashcardsCsv(serializeFlashcardsCsv(cards));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([]);
    expect(
      result.cards.map(({ japanese, english, folder }) => ({
        japanese,
        english,
        folder,
      })),
    ).toEqual(
      cards.map(({ japanese, english, folder }) => ({
        japanese,
        english,
        folder,
      })),
    );
  });

  it("produces an empty deck as a header-only file", () => {
    expect(serializeFlashcardsCsv([])).toBe("japanese,english,folder");
  });
});

describe("folderNames", () => {
  it("returns distinct folders in first-seen order", () => {
    const cards = [
      { id: "1", japanese: "猫", english: "cat", folder: "Animals" },
      { id: "2", japanese: "犬", english: "dog", folder: "Animals" },
      { id: "3", japanese: "本", english: "book", folder: "Objects" },
    ];

    expect(folderNames(cards)).toEqual(["Animals", "Objects"]);
  });
});
