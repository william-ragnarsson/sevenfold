"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deckFileError, MAX_SIZE_MB } from "@/components/ui/Dropzone";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";
import { isPending, MAX_QUEUE, useAnalysis } from "./AnalysisProvider";

const BUSY = "An analysis is already running";

/**
 * How the dashboard pages start a run: "New analysis" opens the file picker and
 * runs the PDFs picked, "Try the sample deck" runs the bundled one, and PDFs
 * dropped anywhere on the page run too. One PDF, with nothing running, opens
 * its report as it runs. Several, or any while a run is going, join the queue
 * (`AnalysisQueue`) and run one after another. The sample is off while anything
 * runs or waits, because starting it would abort the deck running.
 *
 * The landing page keeps the big dropzone (`AnalysisLauncher`) instead.
 */
export default function NewAnalysisActions() {
  const { status, setFile, start, startSample, replaySample, queue, enqueue } = useAnalysis();
  const busy = status === "loading" || queue.some(isPending);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function run(files: File[]) {
    if (files.length === 0) return;
    const rejected = files.filter((file) => deckFileError(file) !== null);
    const decks = files.filter((file) => !rejected.includes(file));
    const problems: string[] = [];
    // One file keeps the dropzone's own message; several get a count.
    if (rejected.length > 0) problems.push(files.length === 1 ? deckFileError(files[0])! : skipped(rejected));

    if (decks.length === 1 && !busy) {
      // So the live card and the report can show the file's name before the company's is known.
      setFile(decks[0]);
      start({ file: decks[0] });
    } else if (decks.length > 0) {
      const left = await enqueue(decks);
      if (left > 0) problems.push(`${left} more didn't fit: at most ${MAX_QUEUE} decks can wait at once.`);
    }
    setError(problems.join(" "));
  }

  const onDrop = useEffectEvent((files: File[]) => void run(files));

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
      // Copied now: the drop's file list empties once the event is over.
      onDrop(Array.from(e.dataTransfer?.files ?? []));
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
        {process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={replaySample}
            disabled={busy}
            title={busy ? BUSY : "Plays a scripted run of the sample. No request, no cost."}
            className="rounded-full px-3 py-2.5 font-mono text-xs text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Replay sample (free, dev)
          </button>
        )}
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
          title={busy ? "Runs once the decks before it have finished" : "Pick one PDF or several"}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-accent"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {busy ? "Add to queue" : "New analysis"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            // Copied first: clearing the value below empties the list.
            void run(Array.from(e.target.files ?? []));
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
              <p className="text-lg font-semibold text-ink">
                {busy ? "Drop to add them to the queue" : "Drop PDFs to analyse them"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {busy
                  ? "Each runs once the decks before it have finished."
                  : `One or several · PDF · up to ${MAX_SIZE_MB}MB each`}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Why the files that aren't decks were left out, naming the file when there's one. */
function skipped(files: File[]): string {
  const what = files.length === 1 ? files[0].name : `${files.length} files`;
  return `Skipped ${what}: only PDFs up to ${MAX_SIZE_MB}MB can be analysed.`;
}
