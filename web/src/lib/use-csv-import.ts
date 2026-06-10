"use client";

import { useCallback, useState } from "react";
import {
  parseFlashcardsCsv,
  type Flashcard,
  type SkippedRow,
} from "./flashcards";

/** A skipped row, tagged with its source file when more than one was imported. */
export type ImportSkipped = SkippedRow & { file?: string };

export type ImportState = {
  /** True while files are being read and parsed. */
  isReading: boolean;
  /** A fatal message shown when nothing could be imported. */
  error: string | null;
  /** Rows dropped during a (partly) successful import. */
  skipped: ImportSkipped[];
  /** Per-file problems when some files imported and others didn't. */
  fileErrors: string[];
  /** How many cards the last successful import added. `0` until one succeeds. */
  added: number;
};

const EMPTY_STATE: ImportState = {
  isReading: false,
  error: null,
  skipped: [],
  fileErrors: [],
  added: 0,
};

/** Whether a picked/dropped file looks like a CSV we can read. */
export function isCsvFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  );
}

/**
 * Reads one or more CSV files, parses each into flashcards, and hands the
 * combined cards to `onCards`. Non-CSV files abort the whole import; a CSV that
 * fails to parse is skipped while the rest still load, with the failures
 * surfaced in `fileErrors`. The caller decides what `onCards` does — replace the
 * deck on first upload, or append to it when adding more later.
 */
export function useCsvImport(onCards: (cards: Flashcard[]) => void) {
  const [state, setState] = useState<ImportState>(EMPTY_STATE);

  const reset = useCallback(() => setState(EMPTY_STATE), []);

  const importFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const nonCsv = files.filter((file) => !isCsvFile(file));
      if (nonCsv.length > 0) {
        const names = nonCsv.map((file) => `"${file.name}"`).join(", ");
        setState({
          ...EMPTY_STATE,
          error:
            nonCsv.length === 1
              ? `${names} is not a CSV file. Please choose .csv files only.`
              : `${names} are not CSV files. Please choose .csv files only.`,
        });
        return;
      }

      const multiple = files.length > 1;
      setState({ ...EMPTY_STATE, isReading: true });

      const cards: Flashcard[] = [];
      const skipped: ImportSkipped[] = [];
      const fileErrors: string[] = [];

      for (const file of files) {
        let text: string;
        try {
          text = await file.text();
        } catch {
          fileErrors.push(`Couldn't read "${file.name}" — it may be corrupted.`);
          continue;
        }

        const result = parseFlashcardsCsv(text);
        if (!result.ok) {
          fileErrors.push(
            multiple ? `"${file.name}": ${result.error}` : result.error,
          );
          continue;
        }

        cards.push(...result.cards);
        for (const row of result.skipped) {
          skipped.push(multiple ? { ...row, file: file.name } : row);
        }
      }

      if (cards.length === 0) {
        setState({
          ...EMPTY_STATE,
          error: fileErrors.join(" ") || "No valid cards found.",
        });
        return;
      }

      onCards(cards);
      setState({
        isReading: false,
        error: null,
        skipped,
        fileErrors,
        added: cards.length,
      });
    },
    [onCards],
  );

  return { ...state, importFiles, reset };
}
