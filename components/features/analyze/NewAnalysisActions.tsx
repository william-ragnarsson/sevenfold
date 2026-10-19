"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deckFileError, MAX_SIZE_MB } from "@/components/ui/Dropzone";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";
import { useAnalysis } from "./AnalysisProvider";

const BUSY = "An analysis is already running";

/**
 * How the dashboard pages start a run: "New analysis" opens the file picker and
 * runs the PDF picked, "Try the sample deck" runs the bundled one, and a PDF
 * dropped anywhere on the page runs too. One run at a time: while one is going
 * everything here is off, because a second start would abort the first.
 *
 * The landing page keeps the big dropzone (`AnalysisLauncher`) instead.
 */
export default function NewAnalysisActions() {
  const { status, setFile, start, startSample } = useAnalysis();
  const busy = status === "loading";
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  function run(file: File | undefined) {
    if (!file || busy) return;
    const problem = deckFileError(file);
    setError(problem ?? "");
    if (problem) return;
    // So the live card and the report can show the file's name before the company's is known.
    setFile(file);
    start({ file });
  }

  const onDrop = useEffectEvent((file: File | undefined) => run(file));

  // The whole window is the drop target. Every file drag is cancelled, busy or
  // not, or the browser would open the PDF in place of the page. The depth count
  // keeps the overlay up while the drag crosses from one element to the next.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"));
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      onDrop(e.dataTransfer?.files[0]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => startSample(AIRBNB_SAMPLE)}
          disabled={busy}
          title={busy ? BUSY : undefined}
          className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink/15 disabled:hover:bg-transparent"
        >
          Try the sample deck
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={busy ? BUSY : undefined}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New analysis
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            run(e.target.files?.[0]);
            // So picking the same file again still fires a change.
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {dragging &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-paper/70 p-6 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-3xl border-2 border-dashed border-accent bg-white/85 px-8 py-16 text-center shadow-[0_40px_80px_-40px_rgba(20,19,15,0.45)]">
              <p className="text-lg font-semibold text-ink">{busy ? BUSY : "Drop the PDF to analyse it"}</p>
              <p className="mt-1 text-sm text-muted">
                {busy ? "Drop the next one once it has finished." : `PDF · up to ${MAX_SIZE_MB}MB`}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
