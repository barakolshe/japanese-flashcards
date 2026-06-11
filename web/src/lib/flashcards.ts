import Papa from "papaparse";

/** A single flashcard parsed from a CSV row. */
export type Flashcard = {
  /** Stable client-side id, used as a React key and for future study state. */
  id: string;
  /** The Japanese word or phrase (front of the card). Required. */
  japanese: string;
  /** The English meaning (back of the card). Required. */
  english: string;
  /** The collection the card belongs to. Defaults to DEFAULT_COLLECTION. */
  collection: string;
};

/** Collection assigned to a card when the CSV leaves the collection column blank. */
export const DEFAULT_COLLECTION = "Uncategorized";

/** Column headers the uploader recognizes (matched case-insensitively). */
export const REQUIRED_COLUMNS = ["japanese", "english"] as const;
export const OPTIONAL_COLUMNS = ["collection"] as const;

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
 * Build a single flashcard with a fresh id. Used when cards are created in the
 * app rather than parsed from a CSV — adding a card by hand, or duplicating an
 * existing card into a copied collection.
 */
export function createCard(
  japanese: string,
  english: string,
  collection: string,
): Flashcard {
  return { id: newId(), japanese, english, collection };
}

/** Where each column lives, plus how to interpret line numbers and rows. */
type ColumnLayout = {
  japanese: number;
  english: number;
  /** -1 when there is no collection column. */
  collection: number;
  /** Rows that hold card data (the header row is excluded when present). */
  dataRows: string[][];
  /** 1-based source line of the first data row (2 with a header, 1 without). */
  firstDataLine: number;
};

/**
 * Decide how to read the parsed rows. A first row that names both `japanese`
 * and `english` (case-insensitively, in any order) is treated as a header and
 * the columns are located by name. Otherwise the file is taken to have no
 * header and columns are read positionally as japanese, english, collection.
 */
function resolveLayout(rows: string[][]): ColumnLayout {
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.includes("japanese") && header.includes("english");

  if (hasHeader) {
    return {
      japanese: header.indexOf("japanese"),
      english: header.indexOf("english"),
      collection: header.indexOf("collection"),
      dataRows: rows.slice(1),
      firstDataLine: 2,
    };
  }

  return {
    japanese: 0,
    english: 1,
    collection: 2,
    dataRows: rows,
    firstDataLine: 1,
  };
}

/**
 * Parse the text of a CSV file into flashcards.
 *
 * The file may start with a header row naming the columns `japanese`,
 * `english`, and (optionally) `collection` — matched case-insensitively and in
 * any order — or it may have no header at all, in which case columns are read
 * positionally as japanese, english, collection. Rows missing a Japanese or
 * English value are skipped and reported; a blank/absent collection falls back
 * to {@link DEFAULT_COLLECTION}.
 */
export function parseFlashcardsCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });

  const rows = parsed.data;
  const isBlank = (row: string[]) => row.every((cell) => cell.trim() === "");
  if (rows.length === 0 || rows.every(isBlank)) {
    return { ok: false, error: "This CSV is empty." };
  }

  const layout = resolveLayout(rows);

  const cards: Flashcard[] = [];
  const skipped: SkippedRow[] = [];

  layout.dataRows.forEach((row, index) => {
    const line = layout.firstDataLine + index;
    const japanese = (row[layout.japanese] ?? "").trim();
    const english = (row[layout.english] ?? "").trim();
    const collection =
      (layout.collection >= 0 ? row[layout.collection] ?? "" : "").trim() ||
      DEFAULT_COLLECTION;

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

    cards.push({ id: newId(), japanese, english, collection });
  });

  if (cards.length === 0) {
    return {
      ok: false,
      error:
        skipped.length > 0
          ? "No valid cards found — every row was missing a Japanese or English value."
          : "This CSV has no card rows.",
    };
  }

  return { ok: true, cards, skipped };
}

/**
 * Serialize flashcards back into CSV text that {@link parseFlashcardsCsv} can
 * read again. Emits a `japanese,english,collection` header followed by one row
 * per card, so a deck round-trips through export and re-upload unchanged. Papa
 * handles quoting of values containing commas, quotes, or newlines.
 */
export function serializeFlashcardsCsv(cards: Flashcard[]): string {
  const fields = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
  // Papa.unparse appends a trailing newline for empty data (but not when there
  // are rows); return the bare header so the output is consistent either way.
  if (cards.length === 0) return fields.join(",");
  return Papa.unparse(
    {
      fields,
      data: cards.map((card) => [card.japanese, card.english, card.collection]),
    },
    { newline: "\n" },
  );
}

/** Distinct collection names present in a set of cards, in first-seen order. */
export function collectionNames(cards: Flashcard[]): string[] {
  const seen = new Set<string>();
  for (const card of cards) {
    if (!seen.has(card.collection)) seen.add(card.collection);
  }
  return [...seen];
}
