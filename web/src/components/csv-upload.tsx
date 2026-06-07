"use client";

import { useId, useRef, useState } from "react";
import {
  DEFAULT_FOLDER,
  parseFlashcardsCsv,
  type SkippedRow,
} from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";

function isCsvFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  );
}

export function CsvUpload() {
  const { loadCards } = useFlashcards();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);

  async function handleFile(file: File) {
    setError(null);
    setSkipped([]);

    if (!isCsvFile(file)) {
      setError(`"${file.name}" is not a CSV file. Please choose a .csv file.`);
      return;
    }

    setIsReading(true);
    try {
      const text = await file.text();
      const result = parseFlashcardsCsv(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSkipped(result.skipped);
      loadCards(result.cards);
    } catch {
      setError(`Couldn't read "${file.name}". The file may be corrupted.`);
    } finally {
      setIsReading(false);
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    // Allow re-selecting the same file after an error.
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        data-dragging={isDragging}
        className="group rounded-2xl border-2 border-dashed border-border bg-surface transition-colors duration-150 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/[0.04]"
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          onChange={onInputChange}
          className="peer sr-only"
        />
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center gap-4 px-6 py-14 text-center outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg sm:py-16"
        >
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-150 group-data-[dragging=true]:scale-110"
          >
            <UploadIcon />
          </span>

          <span className="space-y-1">
            <span className="block text-lg font-semibold text-ink">
              {isReading ? (
                "Reading your file…"
              ) : (
                <>
                  Drop a CSV here, or{" "}
                  <span className="text-primary underline underline-offset-4">
                    choose a file
                  </span>
                </>
              )}
            </span>
            <span className="block text-sm text-muted">
              One row per card. Header columns:{" "}
              <code className="font-mono text-ink">japanese, english, folder</code>
            </span>
          </span>
        </label>
      </div>

      <p className="mt-3 text-center text-sm text-muted">
        The <span className="font-medium text-ink">folder</span> column is
        optional — cards without one go to{" "}
        <span className="font-medium text-ink">{DEFAULT_FOLDER}</span>.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      {skipped.length > 0 ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted"
        >
          <p className="font-medium text-ink">
            Loaded your cards, but skipped {skipped.length} row
            {skipped.length > 1 ? "s" : ""}:
          </p>
          <ul className="mt-2 space-y-0.5">
            {skipped.slice(0, 6).map((row) => (
              <li key={row.line}>
                Line {row.line} — {row.reason}
              </li>
            ))}
            {skipped.length > 6 ? (
              <li className="text-ink">…and {skipped.length - 6} more.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
