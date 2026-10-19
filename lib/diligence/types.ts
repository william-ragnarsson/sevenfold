/**
 * The single contract between backend and frontend.
 *
 * The backend's only job is to produce a `DueDiligenceForm`; the frontend's only
 * job is to render its fields. Each product (`features/<product>`) declares its
 * own slice of the form and its own events; this file puts them together, so
 * adding a product means adding it here (and to the field registry in
 * form-schema.ts) and both sides follow.
 */

import type { CoreEvent } from "@/lib/core/events";
import type { Stage, StageContext } from "@/lib/core/stage";
import type { DiligenceInput } from "@/lib/core/types";
import type { DeckEvent } from "@/features/deck-reader/types";
import type { FeedbackEvent, FeedbackForm } from "@/features/feedback/types";
import type { FoundersForm } from "@/features/founders/types";
import type { LandscapeEvent, LandscapeForm } from "@/features/landscape/types";
import type { MemoForm } from "@/features/memo/types";
import type { ResearchEvent, ResearchForm } from "@/features/research/types";
import type { ScorecardForm } from "@/features/scorecard/types";
import type { VerdictEvent, VerdictForm } from "@/features/verdict/types";

export type {
  DiligenceInput,
  DiligencePhase,
  Field,
  FieldSource,
  ResearchResult,
  SearchGroup,
  Source,
} from "@/lib/core/types";
export { EmptyDeckError } from "@/lib/core/types";
export type { Founder } from "@/features/founders/types";
export type { Scorecard } from "@/features/scorecard/types";
export type { InvestVerdict } from "@/features/verdict/types";
export type { DeckFeedbackItem, DeckFeedbackSeverity } from "@/features/feedback/types";
export type { CompetitiveLandscape, LandscapeAxis, LandscapeCompany } from "@/features/landscape/types";

/**
 * The due-diligence form — mirrors William's Plug-and-Play DD template. Every
 * scalar field carries its value and where it came from, so the UI can badge
 * deck-sourced vs web-sourced cells and fill them in live.
 */
export interface DueDiligenceForm
  extends MemoForm,
    FoundersForm,
    ScorecardForm,
    VerdictForm,
    FeedbackForm,
    LandscapeForm,
    ResearchForm {
  generatedAt: string;
}

/**
 * Progress events the engine emits while it works, streamed to the client as
 * NDJSON. The frontend imports only these types to drive the live form fill.
 */
export type ProgressEvent =
  | CoreEvent
  | DeckEvent
  | ResearchEvent
  | FeedbackEvent
  | VerdictEvent
  | LandscapeEvent
  /** Terminal success event — carries the assembled form. */
  | { type: "report"; report: DueDiligenceForm };

/** Callback the engine calls to report progress as it runs. */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * The diligence engine. The implementation can be swapped without touching the
 * API route or the UI, which depend only on `DueDiligenceForm` + `ProgressEvent`.
 */
export interface DiligenceEngine {
  run(input: DiligenceInput, onEvent?: ProgressCallback, signal?: AbortSignal): Promise<DueDiligenceForm>;
}

/** What each stage of the diligence pipeline gets. */
export type PipelineContext = StageContext<DueDiligenceForm, ProgressEvent>;

/** One stage of the diligence pipeline; see `engine.ts` for the full list. */
export type PipelineStage = Stage<PipelineContext>;
