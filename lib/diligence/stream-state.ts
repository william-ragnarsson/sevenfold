import { applyField, emptyForm } from "@/lib/diligence/form-schema";
import { foldDeck } from "@/features/deck-reader/state";
import type { DeckState } from "@/features/deck-reader/types";
import { foldFeedback, initialFeedbackState } from "@/features/feedback/state";
import type { FeedbackState } from "@/features/feedback/types";
import { foldLandscape, initialLandscapeState } from "@/features/landscape/state";
import type { LandscapeState } from "@/features/landscape/types";
import { foldResearch, initialResearchState } from "@/features/research/state";
import type { ResearchState } from "@/features/research/types";
import { initialScorecardState } from "@/features/scorecard/state";
import type { ScorecardState } from "@/features/scorecard/types";
import { foldVerdict, initialVerdictState } from "@/features/verdict/state";
import type { VerdictState } from "@/features/verdict/types";
import { cacheSavingsOf } from "@/lib/llm/pricing";
import type { DiligencePhase, DueDiligenceForm, ProgressEvent } from "@/lib/diligence/types";

export type { SearchGroup } from "@/lib/core/types";

export type StepStatus = "pending" | "active" | "done";

export interface Step {
  phase: DiligencePhase;
  label: string;
  status: StepStatus;
}

/** Per-stage running token/cost detail, keyed by `ProgressEvent["stage"]`. */
export interface StageUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  webSearches: number;
  costUsd: number;
  savingsUsd: number;
  model: string;
}

/** Dev-only running token/cost total — never populated in production. */
export interface UsageTotals {
  totalCostUsd: number;
  totalSavingsUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalWebSearches: number;
  totalCalls: number;
  byStage: Record<string, StageUsage>;
}

/**
 * The live and saved state of one analysis. Each product keeps its own slice
 * (the `extends` list) and folds its own events into it; this adds the run's
 * progress, the form and the cost overlay.
 */
export interface AnalysisState extends ResearchState, VerdictState, FeedbackState, LandscapeState, ScorecardState {
  phase: DiligencePhase | "uploading";
  steps: Step[];
  /** The form, mutated live as `field` events arrive. */
  form: DueDiligenceForm;
  /** Keys filled so far (drives cell highlight / count). */
  filledCount: number;
  /** Most recently filled key (for a brief highlight). */
  lastKey: string | null;
  startedAt: number | null;
  error: string | null;
  /** Dev-only cost overlay data; stays null in production (no `usage` events arrive). */
  usage: UsageTotals | null;
  /**
   * The deck page by page: what was read off each slide and which fields were
   * cited from it (see `features/deck-reader`). Absent on reports saved before
   * it existed.
   */
  deck?: DeckState;
}

const STEP_ORDER: { phase: DiligencePhase; label: string }[] = [
  { phase: "extracting", label: "Reading deck" },
  { phase: "researching", label: "Researching" },
  { phase: "completing", label: "Completing form" },
  { phase: "verdict", label: "Verdict" },
  { phase: "done", label: "Done" },
];

export function initialState(): AnalysisState {
  return {
    phase: "uploading",
    steps: STEP_ORDER.map((s, i) => ({ ...s, status: i === 0 ? "active" : "pending" })),
    form: emptyForm(),
    filledCount: 0,
    lastKey: null,
    ...initialResearchState(),
    ...initialVerdictState(),
    ...initialFeedbackState(),
    ...initialLandscapeState(),
    startedAt: Date.now(),
    error: null,
    usage: null,
    ...initialScorecardState(),
  };
}

function advanceSteps(steps: Step[], phase: DiligencePhase): Step[] {
  const target = STEP_ORDER.findIndex((s) => s.phase === phase);
  return steps.map((step, i) => {
    if (phase === "done") return { ...step, status: "done" };
    if (i < target) return { ...step, status: "done" };
    if (i === target) return { ...step, status: "active" };
    return { ...step, status: "pending" };
  });
}

export type StreamAction =
  | { type: "reset" }
  | { type: "event"; event: ProgressEvent }
  | { type: "hydrate"; state: AnalysisState };

export function streamReducer(state: AnalysisState, action: StreamAction): AnalysisState {
  if (action.type === "reset") return initialState();
  if (action.type === "hydrate") return action.state;
  const next = reduceEvent(state, action.event);
  // The deck slice folds separately, so it stays one self-contained module.
  const deck = foldDeck(next.deck, action.event);
  return deck === next.deck ? next : { ...next, deck };
}

/** Each product's fold; one that doesn't own the event hands the state back untouched. */
const PRODUCT_FOLDS: ((state: AnalysisState, event: ProgressEvent) => AnalysisState)[] = [
  foldResearch,
  foldVerdict,
  foldFeedback,
  foldLandscape,
];

function reduceEvent(state: AnalysisState, event: ProgressEvent): AnalysisState {
  switch (event.type) {
    case "status":
      return { ...state, phase: event.phase, steps: advanceSteps(state.steps, event.phase) };

    case "field": {
      // Mutate a cloned form so React sees a new reference.
      const form = structuredClone(state.form);
      applyField(form, event.key, event.value, event.source);
      return { ...state, form, filledCount: state.filledCount + 1, lastKey: event.key };
    }

    case "usage": {
      const prev: UsageTotals = state.usage ?? {
        totalCostUsd: 0,
        totalSavingsUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheCreationTokens: 0,
        totalWebSearches: 0,
        totalCalls: 0,
        byStage: {},
      };
      const { usage } = event;
      const savingsUsd = cacheSavingsOf(usage);
      const webSearches = usage.webSearches ?? 0;

      const prevStage: StageUsage = prev.byStage[event.stage] ?? {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        webSearches: 0,
        costUsd: 0,
        savingsUsd: 0,
        model: usage.model,
      };

      return {
        ...state,
        usage: {
          totalCostUsd: prev.totalCostUsd + event.costUsd,
          totalSavingsUsd: prev.totalSavingsUsd + savingsUsd,
          totalInputTokens: prev.totalInputTokens + usage.inputTokens,
          totalOutputTokens: prev.totalOutputTokens + usage.outputTokens,
          totalCacheReadTokens: prev.totalCacheReadTokens + usage.cacheReadTokens,
          totalCacheCreationTokens: prev.totalCacheCreationTokens + usage.cacheCreationTokens,
          totalWebSearches: prev.totalWebSearches + webSearches,
          totalCalls: prev.totalCalls + 1,
          byStage: {
            ...prev.byStage,
            [event.stage]: {
              calls: prevStage.calls + 1,
              inputTokens: prevStage.inputTokens + usage.inputTokens,
              outputTokens: prevStage.outputTokens + usage.outputTokens,
              cacheReadTokens: prevStage.cacheReadTokens + usage.cacheReadTokens,
              cacheCreationTokens: prevStage.cacheCreationTokens + usage.cacheCreationTokens,
              webSearches: prevStage.webSearches + webSearches,
              costUsd: prevStage.costUsd + event.costUsd,
              savingsUsd: prevStage.savingsUsd + savingsUsd,
              model: usage.model,
            },
          },
        },
      };
    }

    case "report":
      return {
        ...state,
        form: event.report,
        verdict: event.report.verdict ?? state.verdict,
        deckFeedback: event.report.deckFeedback ?? state.deckFeedback,
        landscape: event.report.landscape ?? state.landscape ?? null,
        phase: "done",
        steps: advanceSteps(state.steps, "done"),
      };

    case "error":
      return { ...state, error: event.message };

    default:
      // Every other event belongs to one product, which folds it into its own slice.
      return PRODUCT_FOLDS.reduce((next, fold) => fold(next, event), state);
  }
}
