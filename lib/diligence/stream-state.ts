import { emptyForm } from "@/lib/diligence/form-schema";
import { applyField } from "@/lib/diligence/parse";
import { cacheSavingsOf } from "@/lib/llm/pricing";
import type {
  CompetitiveLandscape,
  DeckFeedbackItem,
  DiligencePhase,
  DueDiligenceForm,
  InvestVerdict,
  ProgressEvent,
  Source,
} from "@/lib/diligence/types";

/** One search query and the sources it surfaced. */
export interface SearchGroup {
  query: string;
  sources: Source[];
}

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

export interface AnalysisState {
  phase: DiligencePhase | "uploading";
  steps: Step[];
  /** The form, mutated live as `field` events arrive. */
  form: DueDiligenceForm;
  /** Keys filled so far (drives cell highlight / count). */
  filledCount: number;
  /** Most recently filled key (for a brief highlight). */
  lastKey: string | null;
  searches: SearchGroup[];
  sourceCount: number;
  notes: string;
  verdict: InvestVerdict | null;
  deckFeedback: DeckFeedbackItem[];
  /**
   * The competitor grid, once mapped. Optional because reports saved before
   * it existed don't carry it; read it as `state.landscape ?? null`.
   */
  landscape?: CompetitiveLandscape | null;
  /** Why the landscape is missing, when its stage failed. */
  landscapeError?: string | null;
  /** The landscape stage's own searches, shown on its card while it works. */
  landscapeSearches?: SearchGroup[];
  startedAt: number | null;
  error: string | null;
  /** Dev-only cost overlay data; stays null in production (no `usage` events arrive). */
  usage: UsageTotals | null;
  /**
   * True on every run since the regression model: `form.scorecard.funding` is
   * whole US dollars and 0 means nothing raised. Reports saved before it lack
   * the flag; there 0 meant unknown and amounts were in the deck's currency.
   */
  fundingInUsd?: true;
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
    searches: [],
    sourceCount: 0,
    notes: "",
    verdict: null,
    deckFeedback: [],
    landscape: null,
    landscapeError: null,
    landscapeSearches: [],
    startedAt: Date.now(),
    error: null,
    usage: null,
    fundingInUsd: true,
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

/**
 * Files a source under the latest search, or under "Background research" when
 * it came before any search.
 */
function withSource(searches: SearchGroup[], source: Source): SearchGroup[] {
  if (searches.length === 0) return [{ query: "Background research", sources: [source] }];
  const last = searches[searches.length - 1];
  return [...searches.slice(0, -1), { ...last, sources: [...last.sources, source] }];
}

export type StreamAction =
  | { type: "reset" }
  | { type: "event"; event: ProgressEvent }
  | { type: "hydrate"; state: AnalysisState };

export function streamReducer(state: AnalysisState, action: StreamAction): AnalysisState {
  if (action.type === "reset") return initialState();
  if (action.type === "hydrate") return action.state;
  const event = action.event;

  switch (event.type) {
    case "status":
      return { ...state, phase: event.phase, steps: advanceSteps(state.steps, event.phase) };

    case "field": {
      // Mutate a cloned form so React sees a new reference.
      const form = structuredClone(state.form);
      applyField(form, event.key, event.value, event.source);
      return { ...state, form, filledCount: state.filledCount + 1, lastKey: event.key };
    }

    case "search":
      return { ...state, searches: [...state.searches, { query: event.query, sources: [] }] };

    case "source": {
      const searches = withSource(state.searches, { title: event.title, url: event.url });
      return { ...state, searches, sourceCount: state.sourceCount + 1 };
    }

    case "note":
      return { ...state, notes: state.notes + event.text };

    case "verdict":
      return { ...state, verdict: event.verdict };

    case "feedback":
      return { ...state, deckFeedback: [...state.deckFeedback, event.item] };

    case "landscape-search":
      return {
        ...state,
        landscapeSearches: [...(state.landscapeSearches ?? []), { query: event.query, sources: [] }],
      };

    case "landscape-source":
      return {
        ...state,
        landscapeSearches: withSource(state.landscapeSearches ?? [], { title: event.title, url: event.url }),
      };

    case "landscape":
      return { ...state, landscape: event.landscape };

    case "landscape-failed":
      return { ...state, landscapeError: event.message };

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
      return state;
  }
}
