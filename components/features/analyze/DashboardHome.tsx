"use client";

import Link from "next/link";
import AnalysisLauncher from "./AnalysisLauncher";
import { useAnalysis } from "./AnalysisProvider";
import { relativeTime } from "./elapsed";
import { useAuth } from "@/components/features/auth/AuthProvider";
import LegacyImportPrompt from "@/components/features/auth/LegacyImportPrompt";
import VerdictBadge, { verdictScore } from "@/features/verdict/ui/VerdictBadge";
import type { AnalysisSummary } from "@/lib/analyses/store";
import { isStalled } from "@/lib/analyses/status";
import { analysisPath, ROUTES } from "@/lib/routes";

const RECENT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function withinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() <= days * DAY_MS;
}

/** The account's numbers, worked out from the list it already has. */
function metricsOf(history: AnalysisSummary[]) {
  const scored = history.filter((r) => r.verdict?.available);
  const scores = scored.map((r) => verdictScore(r.verdict)).filter((s) => s !== null);
  return [
    { label: "Decks analysed", value: String(history.length), note: "since you started" },
    {
      label: "Last 30 days",
      value: String(history.filter((r) => withinDays(r.generatedAt, 30)).length),
      note: "new analyses",
    },
    {
      label: "Recommended",
      value: String(scored.filter((r) => r.verdict?.invest).length),
      note: scored.length ? `of ${scored.length} scored by the model` : "none scored yet",
    },
    {
      label: "Average score",
      value: scores.length ? String(Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)) : "—",
      note: "out of 100, across scored decks",
    },
  ];
}

/**
 * Where the dashboard opens: the dropzone for the next deck, the last few
 * analyses as cards, and the account's numbers. The full list lives on
 * /dashboard/analyses.
 */
export default function DashboardHome() {
  const { history, historyLoading, refreshHistory } = useAnalysis();
  const { user, loading: authLoading, configured } = useAuth();
  // Without accounts there's nothing saved to show, just the dropzone.
  const showSaved = configured && !authLoading && (user !== null || historyLoading);

  return (
    <div className="space-y-10">
      <section>
        <AnalysisLauncher />
      </section>

      <LegacyImportPrompt onImported={() => void refreshHistory()} />

      {showSaved && (
        <>
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Recent analyses</h2>
              {history.length > 0 && (
                <Link href={ROUTES.analyses} className="text-sm font-medium text-accent hover:underline">
                  View all →
                </Link>
              )}
            </div>
            {historyLoading && history.length === 0 ? (
              <p className="rounded-3xl border border-ink/12 bg-paper-2/50 px-5 py-4 text-sm text-muted">Loading…</p>
            ) : history.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-ink/15 px-5 py-6 text-sm text-muted">
                Nothing here yet. Drop a deck above and its analysis will be waiting here.
              </p>
            ) : (
              // One row, left to right; it scrolls sideways where five don't fit.
              <ul className="-mx-1 grid auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-4 overflow-x-auto px-1 pb-2">
                {history.slice(0, RECENT).map((record) => (
                  <li key={record.rowId} className="flex">
                    <RecentCard record={record} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">At a glance</h2>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricsOf(history).map((m) => (
                <div key={m.label} className="rounded-3xl border border-ink/12 bg-paper-2/50 p-5 backdrop-blur">
                  <dt className="text-sm font-medium text-muted">{m.label}</dt>
                  <dd className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-ink">{m.value}</dd>
                  <dd className="mt-1 text-xs text-muted">{m.note}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function RecentCard({ record }: { record: AnalysisSummary }) {
  const name = record.name || "Untitled deck";
  const unfinished = record.status === "running" && isStalled(record.status, record.startedAt);
  const status =
    record.status === "error"
      ? { label: "Failed", pill: "bg-red-500/10 text-red-700" }
      : unfinished
        ? { label: "Unfinished", pill: "bg-red-500/10 text-red-700" }
        : record.status === "running"
          ? { label: "Running", pill: "bg-amber-500/10 text-amber-700" }
          : null;

  return (
    <Link
      href={analysisPath(record.id)}
      className="group flex w-full flex-col rounded-3xl border border-ink/12 bg-paper-2/50 p-5 backdrop-blur transition-colors hover:border-ink/25 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold uppercase text-paper" aria-hidden>
          {name.charAt(0)}
        </span>
        {status ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.pill}`}>{status.label}</span>
        ) : (
          <VerdictBadge verdict={record.verdict} />
        )}
      </div>
      <p className="mt-4 line-clamp-2 font-semibold text-ink">{name}</p>
      <p className="mt-1 text-sm text-muted">{relativeTime(record.generatedAt)}</p>
      <span className="mt-auto pt-4 text-sm font-medium text-accent group-hover:underline">Open →</span>
    </Link>
  );
}
