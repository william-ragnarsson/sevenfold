import type { CoreEvent, Emit } from "./events";
import type { DiligenceInput, DiligencePhase, ResearchResult } from "./types";

/**
 * Pipeline stages and the runner that strings them together. Each product
 * exports one or more `Stage`s; `lib/diligence/engine.ts` lists them with the
 * stages each one needs, and `runStages` runs every stage as soon as its needs
 * are done, so independent products run side by side.
 */

/** What every stage gets. The composition layer fills in the form and event types. */
export interface StageContext<F = unknown, E = CoreEvent> {
  input: DiligenceInput;
  /** The report being filled in, shared by every stage. */
  form: F;
  emit: Emit<E>;
  /** Aborts when the caller cancels or a critical stage fails. */
  signal: AbortSignal;
  /** The web research notes, once the research stage has run. */
  research: ResearchResult | null;
}

export interface StageStatus {
  phase: DiligencePhase;
  message: string;
}

export interface Stage<C extends StageContext<unknown, never> = StageContext> {
  /** Unique within a pipeline; other stages name it in `needs`. */
  id: string;
  /** Stages that must finish first. Each must be listed before this one. */
  needs: readonly string[];
  /**
   * False when a failure shouldn't sink the run: the stage's error goes to
   * `onError` and the stages that need it run anyway. Defaults to true.
   */
  critical?: boolean;
  /** Sent just before the stage runs. */
  status?: StageStatus;
  /** Sent while the stage waits on a non-critical stage that's still going. */
  waitingStatus?: StageStatus;
  /** A non-critical stage's failure. Not called when the run was cancelled. */
  onError?(err: unknown, ctx: C): void;
  run(ctx: C): Promise<void>;
}

/** The research notes, for a stage that runs after the research stage. */
export function researchOf(ctx: StageContext<unknown, never>): ResearchResult {
  if (!ctx.research) throw new Error("This stage needs the research stage to run first");
  return ctx.research;
}

/** The context type a stage list runs with. */
type ContextOf<S> = S extends Stage<infer C> ? C : never;

/**
 * Run the stages, each as soon as the stages it needs are done. Rejects with
 * the first critical failure, after aborting everything still running; a
 * stage that needed a failed critical stage never starts. Resolves once every
 * stage has finished.
 */
export async function runStages<S extends Stage<StageContext<unknown, never>>>(
  stages: readonly S[],
  makeContext: (signal: AbortSignal) => ContextOf<S>,
  outer?: AbortSignal,
): Promise<void> {
  const ctl = new AbortController();
  const signal = outer ? AbortSignal.any([outer, ctl.signal]) : ctl.signal;
  const ctx = makeContext(signal);
  // Status and stage events are core events, which every pipeline's emit accepts.
  const emitCore = ctx.emit as unknown as Emit<CoreEvent>;

  let fail: (err: unknown) => void = () => {};
  const failed = new Promise<never>((_, reject) => {
    fail = reject;
  });
  failed.catch(() => {}); // observed through the race below

  interface Need {
    critical: boolean;
    outcome: Promise<boolean>;
    settled: boolean;
  }
  const needsById = new Map<string, Need>();

  async function runOne(stage: S, needs: Need[]): Promise<boolean> {
    try {
      for (const need of needs) {
        if (need.critical && !(await need.outcome)) return false;
      }
      const optional = needs.filter((need) => !need.critical);
      if (stage.waitingStatus && optional.some((need) => !need.settled)) {
        emitCore({ type: "status", ...stage.waitingStatus });
      }
      await Promise.all(optional.map((need) => need.outcome));
      signal.throwIfAborted();
      if (stage.status) emitCore({ type: "status", ...stage.status });
      emitCore({ type: "stage", id: stage.id, state: "start" });
      await stage.run(ctx);
      emitCore({ type: "stage", id: stage.id, state: "done" });
      return true;
    } catch (err) {
      // Only the stage that failed says so: the ones a failure or a cancel
      // stopped short just never finish.
      if (!signal.aborted) emitCore({ type: "stage", id: stage.id, state: "failed" });
      if (stage.critical !== false) {
        fail(err);
        ctl.abort();
      } else if (!signal.aborted) {
        stage.onError?.(err, ctx);
      }
      return false;
    }
  }

  for (const stage of stages) {
    if (needsById.has(stage.id)) throw new Error(`Two stages are named "${stage.id}"`);
    const needs = stage.needs.map((id) => {
      const need = needsById.get(id);
      if (!need) throw new Error(`Stage "${stage.id}" needs "${id}", which isn't listed before it`);
      return need;
    });
    const need: Need = { critical: stage.critical !== false, outcome: runOne(stage, needs), settled: false };
    need.outcome.then(() => {
      need.settled = true;
    });
    needsById.set(stage.id, need);
  }

  try {
    await Promise.race([Promise.all([...needsById.values()].map((need) => need.outcome)), failed]);
  } finally {
    ctl.abort();
  }
}
