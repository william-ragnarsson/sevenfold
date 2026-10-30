"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import AnalysisCard from "./AnalysisCard";
import AnalysisQueue from "./AnalysisQueue";
import { useAnalysis } from "./AnalysisProvider";
import AnalysisRow from "./AnalysisRow";
import CurrentAnalysisCard from "./CurrentAnalysisCard";
import { useAuth } from "@/components/features/auth/AuthProvider";
import LegacyImportPrompt from "@/components/features/auth/LegacyImportPrompt";
import { clearCovers, forgetCover } from "@/features/deck-reader/ui/cover";
import type { AnalysisSummary } from "@/lib/analyses/store";

type View = "cards" | "list";

const VIEW_KEY = "sevenfold:analyses-view";
const viewListeners = new Set<() => void>();

/** The view this browser picked last. Cards unless it chose the list; storage that can't be read means cards. */
function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

function setView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered; the switch below still happens.
  }
  for (const listener of viewListeners) listener();
}

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}

/**
 * The /dashboard/analyses body: the run in progress, if there is one, then
 * every analysis on the account as cover cards or as a list, each deletable,
 * plus Clear all. The page header holds the New analysis button.
 */
export default function AnalysisWorkspace() {
  const { status, history, historyLoading, refreshHistory, deleteRecord, clearHistory } = useAnalysis();
  const { user, loading: authLoading, configured } = useAuth();
  const view = useSyncExternalStore(subscribeView, readView, () => "cards" as const);
  // Without accounts nothing is saved, and before anyone has run anything there's no user.
  const showSaved = configured && !authLoading && (user !== null || historyLoading);

  const remove = (record: AnalysisSummary) => {
    void forgetCover(record.id);
    void deleteRecord(record.rowId);
  };

  return (
    <div className="space-y-8">
      {status === "loading" && <CurrentAnalysisCard />}
      <AnalysisQueue />

      <LegacyImportPrompt onImported={() => void refreshHistory()} />

      {showSaved && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {historyLoading && history.length === 0
                ? "Your analyses"
                : history.length === 1
                  ? "1 analysis"
                  : `${history.length} analyses`}
            </h2>
            {history.length > 0 && (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    void clearCovers();
                    void clearHistory();
                  }}
                  className="text-xs font-medium text-muted transition-colors hover:text-ink"
                >
                  Clear all
                </button>
                <div role="group" aria-label="Show analyses as" className="flex gap-1 rounded-full bg-ink/[0.06] p-1">
                  <ViewButton active={view === "cards"} label="Cards" onClick={() => setView("cards")}>
                    <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" strokeLinejoin="round" />
                  </ViewButton>
                  <ViewButton active={view === "list"} label="List" onClick={() => setView("list")}>
                    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
                  </ViewButton>
                </div>
              </div>
            )}
          </div>

          {historyLoading && history.length === 0 ? (
            <p className="rounded-3xl border border-ink/12 bg-paper-2/50 px-5 py-4 text-sm text-muted">Loading…</p>
          ) : history.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 px-5 py-6 text-sm text-muted">
              Nothing here yet. Drop a PDF anywhere on this page, or try the sample deck.
            </p>
          ) : view === "cards" ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((record) => (
                <li key={record.rowId}>
                  <AnalysisCard record={record} onDelete={() => remove(record)} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-ink/10 overflow-hidden rounded-3xl border border-ink/12 bg-paper-2/50 backdrop-blur">
              {history.map((record) => (
                <AnalysisRow key={record.rowId} record={record} onDelete={() => remove(record)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "grid h-8 w-8 place-items-center rounded-full transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 " +
        (active ? "bg-white text-ink shadow-[0_1px_2px_rgba(20,19,15,0.12)]" : "text-muted hover:text-ink")
      }
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
