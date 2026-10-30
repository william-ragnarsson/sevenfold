"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { REPLAY_ID, useAnalysis } from "./AnalysisProvider";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { getAnalysis, getRunClaim, type AnalysisRecord } from "@/lib/analyses/store";
import { isStalled, STALLED_MESSAGE } from "@/lib/analyses/status";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import type { DueDiligenceForm } from "@/lib/diligence/types";
import { applyMemoEdit, type MemoEdit } from "@/lib/diligence/edits";
import { analysisIdOf } from "@/lib/routes";
import { savedDeckSource } from "./deckSource";

/** How often a report whose run is still going is re-read. */
const POLL_MS = 4000;

/** A run that's still going somewhere else — started from Claude, or in another tab. */
function inProgress(record: AnalysisRecord): boolean {
  return record.status === "running" && !isStalled(record.status, record.startedAt);
}

/** Where the memo's edits stand: being saved, all saved, or one that failed. */
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

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
  /** True when the memo can be edited: a finished, saved report and a signed-in account. */
  canEdit: boolean;
  /** Change the memo. `state` shows it at once; it's saved in the background. */
  editMemo: (edit: MemoEdit) => void;
  saveStatus: SaveStatus;
}

const ReportContext = createContext<OpenReport | null>(null);

/** The analysis the url points at, or null outside one. */
export function useReport(): OpenReport | null {
  return useContext(ReportContext);
}

/** A resolved lookup, tagged with the id it was for — see the effect below. */
type Fetched = { id: string; record: AnalysisRecord | null };

/**
 * The memo as edited here, laid over the report it was edited on, by report
 * id. Each is tagged with its report's `startedAt`, so a rerun never shows the
 * last run's edits.
 */
type Overlay = { startedAt: number | null; form: DueDiligenceForm };
type Overlays = Record<string, Overlay>;

const SAVE_FAILED = "Couldn't save that edit.";

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

  const [overlays, setOverlays] = useState<Overlays>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });

  // Leaving an analysis forgets it, so coming back re-reads it rather than
  // showing last visit's copy as current (it may have finished, failed or gone
  // since). Reset during render, not in an effect, so no frame shows the old one.
  // Its edits go too, since the re-read has them, except a run in this tab's:
  // that is never re-read, so its edits stay laid over it.
  const [openId, setOpenId] = useState(id);
  if (openId !== id) {
    setOpenId(id);
    setFetched(null);
    setOverlays((all) => (currentId && all[currentId] ? { [currentId]: all[currentId] } : {}));
    setSaveStatus({ kind: "idle" });
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
  const saved = isLive ? stream : record?.state ?? null;
  const overlay = id ? overlays[id] : undefined;
  const edited = overlay && saved && overlay.startedAt === saved.startedAt ? overlay.form : null;
  const state = useMemo(() => (saved && edited ? { ...saved, form: edited } : saved), [saved, edited]);
  const active = isLive ? status === "loading" : record !== null && inProgress(record);
  // A run in this tab is editable once it's done; one saved elsewhere once it
  // has stopped. Accounts off or signed out, there's nowhere to save to, and a
  // replay was never saved.
  const canEdit =
    state !== null &&
    !active &&
    user !== null &&
    !user.is_anonymous &&
    id !== REPLAY_ID &&
    (isLive ? status === "done" : record !== null);

  const editMemo = useMemoEditor(id, state, canEdit, isLive ? undefined : (record?.state?.startedAt ?? null), setOverlays, setSaveStatus);
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
    () =>
      id
        ? { id, name, isLive, settled, record, state, active, pdf, failure, canEdit, editMemo, saveStatus }
        : null,
    [id, name, isLive, settled, record, state, active, pdf, failure, canEdit, editMemo, saveStatus],
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

/**
 * `editMemo` for the open report. Each edit is applied to the form shown at
 * once, then sent to `PATCH /api/analyses/<id>`, one at a time and in order.
 * Once the last one is answered the memo shows the server's form, which is the
 * saved one: an edit that failed drops out of it, and edits made in another
 * tab come in.
 *
 * `claim` is the saved row's `startedAt`, which the server checks the edit
 * against. A run in this tab doesn't know it (its `startedAt` is the browser's
 * own), so it passes undefined and the first save looks it up.
 */
function useMemoEditor(
  id: string | null,
  state: AnalysisState | null,
  canEdit: boolean,
  claim: number | null | undefined,
  setOverlays: (update: (all: Overlays) => Overlays) => void,
  setSaveStatus: (status: SaveStatus) => void,
): (edit: MemoEdit) => void {
  // Read when an edit comes in rather than captured, so a stale callback can't
  // edit a report that's no longer open.
  const latest = useRef({ id, state, canEdit, claim });
  useEffect(() => {
    latest.current = { id, state, canEdit, claim };
  });
  const queue = useRef<Promise<void>>(Promise.resolve());
  // The edits to one report (one id and `startedAt`) since it was opened.
  const batch = useRef<Batch | null>(null);

  return useCallback(
    (edit: MemoEdit) => {
      const { id, state, canEdit, claim } = latest.current;
      if (!id || !state || !canEdit) return;
      const key = `${id}:${state.startedAt}`;
      if (batch.current?.key !== key) batch.current = { key, claim, pending: 0, failed: null, form: null, serverForm: null };
      const b = batch.current;

      // Build on the last edit even before a render has shown it.
      const form = structuredClone(b.form ?? state.form);
      if (!applyMemoEdit(form, edit)) return;
      b.form = form;
      b.pending += 1;
      const startedAt = state.startedAt;
      setOverlays((all) => ({ ...all, [id]: { startedAt, form } }));
      setSaveStatus({ kind: "saving" });

      queue.current = queue.current.then(async () => {
        try {
          if (b.claim === undefined) b.claim = await getRunClaim(id);
          if (b.claim === undefined) throw new Error("This analysis isn't saved, so edits to it can't be.");
          const res = await fetch(`/api/analyses/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startedAt: b.claim, edit }),
          });
          const body = (await res.json().catch(() => null)) as { form?: DueDiligenceForm; error?: string } | null;
          if (!res.ok || !body?.form) throw new Error(body?.error || SAVE_FAILED);
          b.serverForm = body.form;
        } catch (err) {
          b.failed = err instanceof Error ? err.message : SAVE_FAILED;
        }
        b.pending -= 1;
        if (b.pending > 0) return;
        // All answered: show what was saved, which drops any edit that failed.
        // Not if the report was closed meanwhile: its re-read has the edits.
        const saved = b.serverForm;
        b.form = saved;
        setOverlays((all) => {
          if (all[id]?.startedAt !== startedAt) return all;
          const rest = { ...all };
          if (saved) rest[id] = { startedAt, form: saved };
          else delete rest[id];
          return rest;
        });
        if (batch.current === b && latest.current.id === id) {
          setSaveStatus(b.failed ? { kind: "error", message: b.failed } : { kind: "saved" });
        }
        b.failed = null;
      });
    },
    [setOverlays, setSaveStatus],
  );
}

type Batch = {
  key: string;
  /** The row's `startedAt`; undefined until looked up, for a run in this tab. */
  claim: number | null | undefined;
  /** Edits sent and not yet answered. */
  pending: number;
  /** Why the last failed edit failed, until the batch is reported. */
  failed: string | null;
  /** The form with every edit so far, saved or not. */
  form: DueDiligenceForm | null;
  /** The form the server last saved. */
  serverForm: DueDiligenceForm | null;
};
