import Papa from "papaparse";

/** A single flashcard parsed from a CSV row. */
export type Flashcard = {
  /** Stable client-side id, used as a React key and for future study state. */
  id: string;
  /** The Japanese word or phrase (front of the card). Required. */
  japanese: string;
  /** The English meaning (back of the card). Required. */
  english: string;
  /** The folder/category the card belongs to. Defaults to DEFAULT_FOLDER. */
  folder: string;
};

/** Folder assigned to a card when the CSV leaves the folder column blank. */
export const DEFAULT_FOLDER = "Uncategorized";

/** Column headers the uploader recognizes (matched case-insensitively). */
export const REQUIRED_COLUMNS = ["japanese", "english"] as const;
export const OPTIONAL_COLUMNS = ["folder"] as const;

/** A row that could not be turned into a card, with a human-readable reason. */
export type SkippedRow = {
  /** 1-based line number in the source file (header row is line 1). */
  line: number;
  reason: string;
};

export type ParseResult =
  | { ok: true; cards: Flashcard[]; skipped: SkippedRow[] }
  | { ok: false; error: string };

function newId(): string {
  // Available in browsers and Node 19+ (our test runtime).
  return crypto.randomUUID();
}

/**
 * Parse the text of a CSV file into flashcards.
 *
 * Expects a header row naming the columns `japanese`, `english`, and
 * (optionally) `folder`. Header matching is case-insensitive and
 * order-independent. Rows missing a Japanese or English value are skipped and
 * reported; a blank/absent folder falls back to {@link DEFAULT_FOLDER}.
 */
export function parseFlashcardsCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    const expected = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(", ");
    return {
      ok: false,
      error:
        `This CSV is missing the ${missing.join(" and ")} ` +
        `column${missing.length > 1 ? "s" : ""}. ` +
        `The first row must name the columns: ${expected} ` +
        `(folder is optional).`,
    };
  }

  const cards: Flashcard[] = [];
  const skipped: SkippedRow[] = [];

  parsed.data.forEach((row, index) => {
    // +2: one for the header row, one to make the line number 1-based.
    const line = index + 2;
    const japanese = (row.japanese ?? "").trim();
    const english = (row.english ?? "").trim();
    const folder = (row.folder ?? "").trim() || DEFAULT_FOLDER;

    const missingFields: string[] = [];
    if (!japanese) missingFields.push("Japanese");
    if (!english) missingFields.push("English");

    if (missingFields.length > 0) {
      skipped.push({
        line,
        reason: `missing ${missingFields.join(" and ")}`,
      });
      return;
    }

    cards.push({ id: newId(), japanese, english, folder });
  });

  if (cards.length === 0) {
    return {
      ok: false,
      error:
        skipped.length > 0
          ? "No valid cards found — every row was missing a Japanese or English value."
          : "This CSV has a header row but no card rows.",
    };
  }

  return { ok: true, cards, skipped };
}

/**
 * Serialize flashcards back into CSV text that {@link parseFlashcardsCsv} can
 * read again. Emits a `japanese,english,folder` header followed by one row per
 * card, so a deck round-trips through export and re-upload unchanged. Papa
 * handles quoting of values containing commas, quotes, or newlines.
 */
export function serializeFlashcardsCsv(cards: Flashcard[]): string {
  return Papa.unparse(
    {
      fields: [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS],
      data: cards.map((card) => [card.japanese, card.english, card.folder]),
    },
    { newline: "\n" },
  );
}

/** Distinct folder names present in a set of cards, in first-seen order. */
export function folderNames(cards: Flashcard[]): string[] {
  const seen = new Set<string>();
  for (const card of cards) {
    if (!seen.has(card.folder)) seen.add(card.folder);
  }
  return [...seen];
}
