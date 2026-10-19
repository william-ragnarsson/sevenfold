"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAnalysis } from "./AnalysisProvider";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { getAnalysis, type AnalysisRecord } from "@/lib/analyses/store";
import { isStalled, STALLED_MESSAGE } from "@/lib/analyses/status";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import { analysisIdOf } from "@/lib/routes";
import { savedDeckSource } from "./deckSource";

/** How often a report whose run is still going is re-read. */
const POLL_MS = 4000;

/** A run that's still going somewhere else — started from Claude, or in another tab. */
function inProgress(record: AnalysisRecord): boolean {
  return record.status === "running" && !isStalled(record.status, record.startedAt);
}

/** The analysis open in the dashboard, shared by its pages and the sidebar. */
export interface OpenReport {
  /** The deck hash from the url. */
  id: string;
  /** The company's name, else the deck's, for titles and the sidebar. */
  name: string;
  /** True when this tab is running it right now. */
  isLive: boolean;
  /** False until the saved copy has been looked up (always true for a live run). */
  settled: boolean;
  /** The saved row; null for a live run, while loading, or when there is none. */
  record: AnalysisRecord | null;
  /** The report so far; null while loading or when there's nothing to show. */
  state: AnalysisState | null;
  /** True while the run is still going, here or elsewhere. */
  active: boolean;
  /** The deck's PDF, for slide images; null when there isn't one to show. */
  pdf: PdfSource | null;
  /** Why the run stopped short: this tab's error, or a saved run that failed or died. */
  failure: string | null;
}

const ReportContext = createContext<OpenReport | null>(null);

/** The analysis the url points at, or null outside one. */
export function useReport(): OpenReport | null {
  return useContext(ReportContext);
}

/** A resolved lookup, tagged with the id it was for — see the effect below. */
type Fetched = { id: string; record: AnalysisRecord | null };

/**
 * Loads the analysis in the url (`/dashboard/analyses/<id>/…`) once, for every
 * page of it and for the sidebar beside them, so moving between its product
 * pages never re-fetches. Sits in the dashboard shell, above both.
 */
export default function ReportProvider({ children }: { children: ReactNode }) {
  const id = analysisIdOf(usePathname());
  const { stream, status, currentId, error, localDeck, file } = useAnalysis();
  const { loading: authLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const [fetched, setFetched] = useState<Fetched | null>(null);

  // Leaving an analysis forgets it, so coming back re-reads it rather than
  // showing last visit's copy as current (it may have finished, failed or gone
  // since). Reset during render, not in an effect, so no frame shows the old one.
  const [openId, setOpenId] = useState(id);
  if (openId !== id) {
    setOpenId(id);
    setFetched(null);
  }

  const isLive = id !== null && currentId === id;

  // A live run already has everything in context — skip the round-trip. Wait
  // for auth first: querying before the session resolves returns nothing (RLS
  // scopes every row to auth.uid()) and would flash "not available". Re-run on
  // a change of user too: after a sign-out the old account's report must go.
  useEffect(() => {
    if (!id || isLive || authLoading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    let last: AnalysisRecord | null = null;

    const load = () => {
      getAnalysis(id).then((record) => {
        if (cancelled) return;
        const wasPolling = polling;
        // A failed re-read mid-run is a blip, not a deleted report: keep
        // showing the last one — until that run is too old to still be going.
        last = record ?? (wasPolling ? last : null);
        // A run still going elsewhere saves its progress every few seconds;
        // re-reading follows along until it's over.
        polling = last !== null && inProgress(last);
        if (record || !wasPolling || !polling) setFetched({ id, record: last });
        if (polling) timer = setTimeout(load, POLL_MS);
      });
    };
    load();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, isLive, authLoading, userId]);

  // The reset above clears the last report on a change of url, but a lookup
  // for it can still land before its effect is cleaned up. Only a result
  // tagged with this url's id counts, so the old report can't reappear here.
  const settled = isLive || (!authLoading && fetched?.id === id);
  const record = isLive || fetched?.id !== id ? null : fetched.record;
  const state = isLive ? stream : record?.state ?? null;
  const active = isLive ? status === "loading" : record !== null && inProgress(record);
  const name =
    state?.form.company.name.value.trim() ||
    record?.name ||
    (isLive && file ? file.name.replace(/\.pdf$/i, "").trim() : "") ||
    "Untitled deck";
  // Where the Deck page gets slide images: the file picked this session, else
  // the bundled sample, else the saved copy. Runs started from Claude have no
  // PDF, so their slides show as numbered tiles.
  const deckPath = record?.deckPath ?? null;
  const pdf = useMemo<PdfSource | null>(() => {
    if (!id) return null;
    if (localDeck?.key === id) return localDeck;
    return savedDeckSource(id, deckPath);
  }, [id, localDeck, deckPath]);
  const failure = isLive
    ? status === "error"
      ? error
      : null
    : // A saved run that won't finish: failed, or its function died mid-way.
      record && (record.status === "error" || isStalled(record.status, record.startedAt))
      ? record.error || STALLED_MESSAGE
      : null;

  const value = useMemo<OpenReport | null>(
    () => (id ? { id, name, isLive, settled, record, state, active, pdf, failure } : null),
    [id, name, isLive, settled, record, state, active, pdf, failure],
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}
