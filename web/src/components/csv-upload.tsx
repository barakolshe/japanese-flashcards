"use client";

import { useId, useRef, useState } from "react";
import { DEFAULT_COLLECTION } from "@/lib/flashcards";
import { useFlashcards } from "@/lib/flashcards-store";
import { useCsvImport } from "@/lib/use-csv-import";

export function CsvUpload() {
  const { loadCards } = useFlashcards();
  const { isReading, error, skipped, fileErrors, importFiles } =
    useCsvImport(loadCards);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) void importFiles(files);
    // Allow re-selecting the same file(s) after an error.
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) void importFiles(files);
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
          multiple
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
                "Reading your files…"
              ) : (
                <>
                  Drop CSV files here, or{" "}
                  <span className="text-primary underline underline-offset-4">
                    choose files
                  </span>
                </>
              )}
            </span>
            <span className="block text-sm text-muted">
              One row per card. Columns:{" "}
              <code className="font-mono text-ink">
                japanese, english, collection, pronunciation
              </code>
            </span>
          </span>
        </label>
      </div>

      <p className="mt-3 text-center text-sm text-muted">
        Pick several files at once if you like. A header row is optional — without
        one, columns are read in order. Cards without a{" "}
        <span className="font-medium text-ink">collection</span> go to{" "}
        <span className="font-medium text-ink">{DEFAULT_COLLECTION}</span>;{" "}
        <span className="font-medium text-ink">pronunciation</span> is optional.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <ImportNotice skipped={skipped} fileErrors={fileErrors} />
    </div>
  );
}

/**
 * Shows non-fatal import feedback: files that couldn't be parsed (when others
 * still loaded) and individual rows that were dropped. Shared in spirit with the
 * "add more cards" flow on the study screen.
 */
export function ImportNotice({
  skipped,
  fileErrors,
}: {
  skipped: { line: number; reason: string; file?: string }[];
  fileErrors: string[];
}) {
  if (skipped.length === 0 && fileErrors.length === 0) return null;

  return (
    <div
      role="status"
      className="mt-5 space-y-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted"
    >
      {fileErrors.length > 0 ? (
        <div>
          <p className="font-medium text-ink">
            Skipped {fileErrors.length} file
            {fileErrors.length > 1 ? "s" : ""}:
          </p>
          <ul className="mt-2 space-y-0.5">
            {fileErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {skipped.length > 0 ? (
        <div>
          <p className="font-medium text-ink">
            Skipped {skipped.length} row{skipped.length > 1 ? "s" : ""}:
          </p>
          <ul className="mt-2 space-y-0.5">
            {skipped.slice(0, 6).map((row) => (
              <li key={`${row.file ?? ""}:${row.line}`}>
                {row.file ? `${row.file}, line ${row.line}` : `Line ${row.line}`}{" "}
                — {row.reason}
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
