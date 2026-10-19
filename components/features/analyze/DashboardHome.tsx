"use client";

import Link from "next/link";
import AnalysisCard from "./AnalysisCard";
import { useAnalysis } from "./AnalysisProvider";
import CurrentAnalysisCard from "./CurrentAnalysisCard";
import { useAuth } from "@/components/features/auth/AuthProvider";
import LegacyImportPrompt from "@/components/features/auth/LegacyImportPrompt";
import { verdictScore } from "@/features/verdict/ui/VerdictBadge";
import type { AnalysisSummary } from "@/lib/analyses/store";
import { ROUTES } from "@/lib/routes";

const RECENT = 6;
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
 * The dashboard's body: the run in progress, if there is one, then the
 * account's numbers and its newest analyses as cards. The page header holds
 * the New analysis button; the full list lives on /dashboard/analyses.
 */
export default function DashboardHome() {
  const { status, history, historyLoading, refreshHistory } = useAnalysis();
  const { user, loading: authLoading, configured } = useAuth();
  // Without accounts nothing is saved, so there's nothing to show here.
  const showSaved = configured && !authLoading && (user !== null || historyLoading);
  // Before the list arrives the numbers would all read 0, so they wait.
  const pending = historyLoading && history.length === 0;

  return (
    <div className="space-y-10">
      {status === "loading" && <CurrentAnalysisCard />}

      <LegacyImportPrompt onImported={() => void refreshHistory()} />

      {showSaved && (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">At a glance</h2>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricsOf(history).map((m) => (
                <div key={m.label} className="rounded-3xl border border-ink/12 bg-paper-2/50 p-5 backdrop-blur">
                  <dt className="text-sm font-medium text-muted">{m.label}</dt>
                  <dd className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-ink">
                    {pending ? "—" : m.value}
                  </dd>
                  <dd className="mt-1 text-xs text-muted">{pending ? " " : m.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Recent analyses</h2>
              {history.length > 0 && (
                <Link href={ROUTES.analyses} className="text-sm font-medium text-accent hover:underline">
                  View all →
                </Link>
              )}
            </div>
            {pending ? (
              <p className="rounded-3xl border border-ink/12 bg-paper-2/50 px-5 py-4 text-sm text-muted">Loading…</p>
            ) : history.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-ink/15 px-5 py-6 text-sm text-muted">
                Nothing here yet. Drop a PDF anywhere on this page, or try the sample deck.
              </p>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {history.slice(0, RECENT).map((record) => (
                  <li key={record.rowId}>
                    <AnalysisCard record={record} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
