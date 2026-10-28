"use client";

import Link from "next/link";
import { analysisPath } from "@/lib/routes";
import { isPending, useAnalysis, type QueuedDeck } from "./AnalysisProvider";

const PILL = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium";
const ROW = "flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-3";
const ACTION = "text-xs font-medium text-muted transition-colors hover:text-ink";

const STATUS: Record<QueuedDeck["status"], { label: string; pill: string }> = {
  queued: { label: "Waiting", pill: "bg-ink/[0.06] text-muted" },
  running: { label: "Analysing", pill: "bg-amber-500/10 text-amber-700" },
  done: { label: "Done", pill: "bg-emerald-500/10 text-emerald-700" },
  existing: { label: "Already analysed", pill: "bg-ink/[0.06] text-ink/70" },
  failed: { label: "Failed", pill: "bg-red-500/10 text-red-700" },
  cancelled: { label: "Cancelled", pill: "bg-ink/[0.06] text-muted" },
};

/**
 * The decks added together (`AnalysisProvider`'s queue), one line each with
 * where it stands, while any of them waits or runs and until it's dismissed.
 * Cancelling the rest leaves the deck running to its own card's abort button.
 */
export default function AnalysisQueue() {
  const { queue, stream, currentId, history, cancelQueue, clearQueue } = useAnalysis();
  if (queue.length === 0) return null;

  const saved = new Set(history.map((record) => record.id));
  const names = new Map(history.map((record) => [record.id, record.name]));
  const settled = queue.filter((deck) => !isPending(deck)).length;
  const waiting = queue.filter((deck) => deck.status === "queued").length;
  const activeIndex = stream.steps.findIndex((s) => s.status === "active");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Queue · {settled} of {queue.length} finished
        </h2>
        <div className="flex items-center gap-4">
          {waiting > 0 && (
            <button type="button" onClick={cancelQueue} className={ACTION}>
              Cancel the rest
            </button>
          )}
          {settled > 0 && (
            <button type="button" onClick={clearQueue} className={ACTION}>
              {settled === queue.length ? "Dismiss" : "Clear finished"}
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-ink/10 overflow-hidden rounded-3xl border border-ink/12 bg-paper-2/50 backdrop-blur">
        {queue.map((deck) => {
          const live = deck.status === "running" && deck.id === currentId;
          const name = (live && stream.form.company.name.value) || names.get(deck.id) || deck.file.name;
          const detail = live
            ? `${activeIndex === -1 ? "Working" : stream.steps[activeIndex].label}… ${
                activeIndex === -1 ? stream.steps.length : activeIndex + 1
              }/${stream.steps.length}`
            : deck.status === "failed"
              ? deck.error
              : undefined;
          // A report to open: the one running, the one this tab still holds, or a saved one.
          const href =
            deck.status === "running" || deck.id === currentId || saved.has(deck.id) ? analysisPath(deck.id) : null;
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-ink" title={deck.file.name}>
                  {name}
                </span>
                <span className={`${PILL} ${STATUS[deck.status].pill}`}>{STATUS[deck.status].label}</span>
              </span>
              {detail && (
                <span className="min-w-0 truncate text-sm text-muted" title={detail}>
                  {detail}
                </span>
              )}
            </>
          );

          return (
            <li key={deck.id} className="flex items-center">
              {href ? (
                <Link href={href} className={`${ROW} transition-colors hover:bg-paper-2`}>
                  {body}
                </Link>
              ) : (
                <div className={ROW}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
