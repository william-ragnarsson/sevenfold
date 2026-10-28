"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { initialState, streamReducer, type AnalysisState } from "@/lib/diligence/stream-state";
import { readProgressStream } from "@/lib/diligence/stream";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { hashFile } from "@/lib/analyses/hash";
import { stashDeck } from "@/lib/analyses/pending-deck";
import { analysisPath, ROUTES, signInPath } from "@/lib/routes";
import {
  clearAnalyses,
  deleteAnalysis,
  getAnalysis,
  listAnalyses,
  type AnalysisSummary,
} from "@/lib/analyses/store";
import type { SampleDeck } from "@/lib/samples/airbnb";
import { pdfFromFile, type PdfSource } from "@/lib/analyses/pdf-source";

const EMPTY_HISTORY: AnalysisSummary[] = [];

type Status = "idle" | "loading" | "done" | "error";

/**
 * At most this many decks wait or run at once, the account's daily allowance
 * of new analyses (`DAILY_LIMIT_IDENTIFIED`, `lib/analyses/persist.ts`).
 */
export const MAX_QUEUE = 25;

/** One deck of a batch, from being added until the batch is dismissed. */
export interface QueuedDeck {
  /** The deck's hash: its report's id, and the entry's key. */
  id: string;
  file: File;
  /** `existing`: the deck already had a finished report, so nothing ran. */
  status: "queued" | "running" | "done" | "existing" | "failed" | "cancelled";
  error?: string;
}

/** How one call to `run` ended. */
type RunOutcome = Pick<QueuedDeck, "status" | "error">;

/** Waiting or running: not settled yet. */
export function isPending(deck: QueuedDeck): boolean {
  return deck.status === "queued" || deck.status === "running";
}

interface AnalysisContextValue {
  file: File | null;
  setFile: (file: File | null) => void;
  status: Status;
  error: string;
  stream: AnalysisState;
  /** Hash id of the run currently in the provider (running or just-finished); null when idle. */
  currentId: string | null;
  /**
   * The PDF the user picked, keyed by its hash, so its report can draw slide
   * thumbnails from the local file instead of downloading the saved copy.
   */
  localDeck: PdfSource | null;
  /**
   * Start analysis for the current file, or `opts.file` when the caller has
   * one that hasn't reached state yet. Re-viewing a saved deck routes to its
   * report instead; without an account, it goes to sign-up first.
   */
  start: (opts?: { force?: boolean; file?: File }) => void;
  /** Start analysis for a built-in sample deck — no upload, no file needed. */
  startSample: (sample: SampleDeck, opts?: { force?: boolean }) => void;
  /**
   * Aborts an in-flight run (if any) and clears back to the dropzone state. A
   * batch's run counts as cancelled, and the next deck in the queue starts.
   */
  stop: () => void;
  /**
   * The decks added together, in order, each run once the run before it is
   * over. Kept in this tab only: a reload drops the waiting ones.
   */
  queue: QueuedDeck[];
  /**
   * Adds decks to the queue. One already waiting or running is skipped, and
   * one that has a finished report is opened from it rather than run again.
   * Resolves to how many didn't fit under `MAX_QUEUE`.
   */
  enqueue: (files: File[]) => Promise<number>;
  /** Cancels every deck still waiting. The one running carries on. */
  cancelQueue: () => void;
  /** Drops the finished, failed and cancelled decks from the queue. */
  clearQueue: () => void;
  history: AnalysisSummary[];
  /** True while the first fetch for the current user is in flight. */
  historyLoading: boolean;
  refreshHistory: () => Promise<void>;
  deleteRecord: (rowId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within an AnalysisProvider");
  return ctx;
}

export default function AnalysisProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, dataVersion, configured, isIdentified } = useAuth();
  const [file, setFileState] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [localDeck, setLocalDeck] = useState<PdfSource | null>(null);
  const [records, setRecords] = useState<AnalysisSummary[]>(EMPTY_HISTORY);
  // Which user `records` belongs to. Tracking it lets both the list and its
  // loading flag be *derived*, so switching users can't leave one account
  // briefly looking at another's analyses.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [stream, dispatch] = useReducer(streamReducer, undefined, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const [queue, setQueue] = useState<QueuedDeck[]>([]);
  // The queue as of the last change, for the async code that reads it after
  // an await; `queue` is the same list for rendering.
  const queueRef = useRef<QueuedDeck[]>([]);
  // The batch deck being run, so the queue starts one deck at a time.
  const runningRef = useRef<string | null>(null);
  const router = useRouter();

  const userId = user?.id ?? null;
  const history = loadedFor !== null && loadedFor === userId ? records : EMPTY_HISTORY;
  const historyLoading = Boolean(userId) && loadedFor !== userId;

  const refreshHistory = useCallback(async () => {
    const next = await listAnalyses();
    setRecords(next);
    setLoadedFor(userId);
  }, [userId]);

  // History is per-user, so it reloads whenever the user does — including the
  // anonymous → signed-in upgrade, where the same rows arrive under a real
  // account. `dataVersion` covers the case where that hand-over finishes after
  // this list has already loaded. No user means there is nothing to fetch yet.
  useEffect(() => {
    if (authLoading || !userId) return;

    let cancelled = false;
    listAnalyses().then((next) => {
      if (cancelled) return;
      setRecords(next);
      setLoadedFor(userId);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, dataVersion]);

  function setFile(f: File | null) {
    setFileState(f);
    if (status !== "loading") {
      setStatus("idle");
      setError("");
    }
  }

  /**
   * The one analysis path, shared by uploads and sample decks. They differ only
   * in how the id is derived and what goes in the request body — everything
   * after that, including naming and persistence, is the route's job now.
   */
  const run = useCallback(
    async ({
      id,
      body,
      force,
      open = true,
    }: {
      id: string;
      body: FormData;
      force?: boolean;
      /** Go to the report. A batch's decks run without taking the page over. */
      open?: boolean;
    }): Promise<RunOutcome> => {
      // One run at a time: this one takes over from any still going, before
      // anything else, so that one can't write into this one's stream or
      // finish after this one has started. Owning the controller from here on
      // also lets a stop during the dedupe check below call the run off.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Claim the run and navigate *first*. The dedupe check below is a
      // round-trip, and doing it before any state changed left the button
      // sitting there looking dead. Both outcomes land on this same URL anyway.
      //
      // It has to be the full claim, not just the push: the report page
      // decides it is showing a live run from `currentId`, so navigating
      // without setting it flashes "This analysis isn't available" until the
      // lookup returns.
      setCurrentId(id);
      setStatus("loading");
      setError("");
      dispatch({ type: "reset" });
      if (open) router.push(analysisPath(id));

      // A convenience, not a gate, so it isn't allowed to take the run down
      // with it — and now that the loading state is already on screen, an
      // unhandled rejection here would strand it there forever.
      try {
        // Already analyzed this exact deck — hand the page over to the saved
        // copy rather than spending another few minutes on the same answer.
        if (!force) {
          const existing = await getAnalysis(id);
          if (controller.signal.aborted) return { status: "cancelled" };
          if (existing?.status === "done") {
            setCurrentId(null);
            setStatus("idle");
            return { status: "existing" };
          }
        }
      } catch (err) {
        console.warn("[analysis] pre-flight failed, running anyway:", err);
      }
      if (controller.signal.aborted) return { status: "cancelled" };

      try {
        const res = await fetch("/api/analyze", { method: "POST", body, signal: controller.signal });
        if (!res.body) throw new Error("No response stream.");

        let sawReport = false;
        for await (const event of readProgressStream(res.body)) {
          // Events already read when a stop came in belong to a run that's over.
          if (controller.signal.aborted) return { status: "cancelled" };
          dispatch({ type: "event", event });
          if (event.type === "report") sawReport = true;
          else if (event.type === "error") throw new Error(event.message);
        }

        if (!sawReport) throw new Error("Analysis ended without a result.");
        setStatus("done");

        // The route saved the report as it streamed; just pick up the new row.
        await refreshHistory();
        return { status: "done" };
      } catch (e) {
        // An explicit stop, a run that took over, or navigating away.
        if (controller.signal.aborted) return { status: "cancelled" };
        const message = e instanceof Error ? e.message : "Something went wrong.";
        setError(message);
        setStatus("error");
        await refreshHistory();
        return { status: "failed", error: message };
      }
    },
    [router, refreshHistory],
  );

  /**
   * Runs need an account (the route checks too). Someone without one — the
   * landing page's dropzone is open to everyone — has their pick kept in the
   * browser and is sent to sign up; the dashboard starts it once they're in
   * (`ResumeStashedDeck`). Returns whether it took the deck.
   */
  const deferUntilSignedIn = useCallback(
    async (deck: { file: File } | { sampleId: string }) => {
      if (!configured || isIdentified) return false;
      await stashDeck(deck);
      router.push(signInPath(ROUTES.dashboard));
      return true;
    },
    [configured, isIdentified, router],
  );

  const start = useCallback(
    async (opts?: { force?: boolean; file?: File }) => {
      const current = opts?.file ?? file;
      if (!current) return;
      if (await deferUntilSignedIn({ file: current })) return;

      const body = new FormData();
      body.append("file", current);

      const id = await hashFile(current);
      setLocalDeck(pdfFromFile(current, id));
      await run({ id, body, force: opts?.force });
    },
    [file, run, deferUntilSignedIn],
  );

  /**
   * Runs one of the built-in sample decks. Its id is the sample PDF's own
   * SHA-256, so it dedupes and routes exactly like an uploaded deck — someone
   * who already ran the sample lands straight on their saved report.
   */
  const startSample = useCallback(
    async (sample: SampleDeck, opts?: { force?: boolean }) => {
      if (await deferUntilSignedIn({ sampleId: sample.id })) return;

      const body = new FormData();
      body.append("sample", sample.id);

      await run({ id: sample.id, body, force: opts?.force });
    },
    [run, deferUntilSignedIn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setError("");
    setCurrentId(null);
    setLocalDeck(null);
    setFileState(null);
    dispatch({ type: "reset" });
  }, []);

  const commitQueue = useCallback((next: QueuedDeck[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const updateQueued = useCallback(
    (id: string, patch: Partial<QueuedDeck>) => {
      commitQueue(queueRef.current.map((deck) => (deck.id === id ? { ...deck, ...patch } : deck)));
    },
    [commitQueue],
  );

  const enqueue = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return 0;
      // Without an account the first deck waits for sign-up like a single
      // pick does; the stash holds one. The dashboard, where several can be
      // picked, is behind sign-in anyway.
      if (await deferUntilSignedIn({ file: files[0] })) return 0;

      const picked = await Promise.all(files.map(async (file) => ({ id: await hashFile(file), file })));
      const current = queueRef.current;
      const pending = current.filter(isPending);
      // Picked twice, already waiting, or the run going on now: once is enough.
      const taken = new Set(pending.map((deck) => deck.id));
      if (status === "loading" && currentId) taken.add(currentId);

      const added: QueuedDeck[] = [];
      let left = 0;
      for (const { id, file } of picked) {
        if (taken.has(id)) continue;
        taken.add(id);
        if (pending.length + added.length >= MAX_QUEUE) left++;
        else added.push({ id, file, status: "queued" });
      }
      // A deck added again after it settled moves to the end as a new entry.
      const readded = new Set(added.map((deck) => deck.id));
      commitQueue([...current.filter((deck) => !readded.has(deck.id)), ...added]);
      return left;
    },
    [deferUntilSignedIn, status, currentId, commitQueue],
  );

  const cancelQueue = useCallback(() => {
    commitQueue(
      queueRef.current.map((deck) => (deck.status === "queued" ? { ...deck, status: "cancelled" } : deck)),
    );
  }, [commitQueue]);

  const clearQueue = useCallback(() => {
    commitQueue(queueRef.current.filter(isPending));
  }, [commitQueue]);

  /**
   * Runs the next waiting deck, once no run is going: one at a time, because
   * a second run would abort the first. Each runs in the background, without
   * taking the page over, and a run started some other way in the meantime
   * (the sample, say) goes first.
   */
  const runNext = useEffectEvent(async () => {
    if (runningRef.current || status === "loading") return;
    const next = queueRef.current.find((deck) => deck.status === "queued");
    if (!next) return;

    runningRef.current = next.id;
    updateQueued(next.id, { status: "running" });
    // As `start` does: the file's name until the company's is known, and its
    // slides drawn from the local copy.
    setFileState(next.file);
    setLocalDeck(pdfFromFile(next.file, next.id));
    const body = new FormData();
    body.append("file", next.file);
    const outcome = await run({ id: next.id, body, open: false });
    // Freed before the update, so the render that update causes runs the next.
    runningRef.current = null;
    updateQueued(next.id, outcome);
  });

  useEffect(() => {
    void runNext();
  }, [status, queue]);

  const deleteRecord = useCallback(
    async (rowId: string) => {
      // Optimistic, then reconciled: a delete that fails puts the row back
      // rather than leaving the list quietly wrong.
      setRecords((prev) => prev.filter((r) => r.rowId !== rowId));
      await deleteAnalysis(rowId);
      await refreshHistory();
    },
    [refreshHistory],
  );

  const clearHistory = useCallback(async () => {
    setRecords(EMPTY_HISTORY);
    await clearAnalyses();
    await refreshHistory();
  }, [refreshHistory]);

  const value: AnalysisContextValue = {
    file,
    setFile,
    status,
    error,
    stream,
    currentId,
    localDeck,
    start,
    startSample,
    stop,
    queue,
    enqueue,
    cancelQueue,
    clearQueue,
    history,
    historyLoading,
    refreshHistory,
    deleteRecord,
    clearHistory,
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
