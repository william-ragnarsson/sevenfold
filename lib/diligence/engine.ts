import { runStages } from "@/lib/core/stage";
import { emptyForm } from "@/lib/diligence/form-schema";
import { feedbackStage } from "@/features/feedback/stage";
import { landscapeStage } from "@/features/landscape/stage";
import { completeStage, extractStage } from "@/features/memo/stage";
import { researchStage } from "@/features/research/stage";
import { scorecardStage } from "@/features/scorecard/stage";
import { verdictStage } from "@/features/verdict/stage";
import type {
  DiligenceEngine,
  DiligenceInput,
  DueDiligenceForm,
  PipelineStage,
  ProgressCallback,
} from "@/lib/diligence/types";

/**
 * The diligence pipeline, all stages streaming into one live-filling form:
 *   1. extract   — fill what the deck says (fast, deck-sourced)
 *   2. research  — web search to verify/augment (search/source/note events)
 *      landscape — map the competitors on a two-axis grid, in parallel with
 *                  2–5 (non-critical: a failure leaves it null)
 *   3. complete  — fill the gaps (web-sourced)
 *   4. scorecard — the seven ratings the invest model reads
 *   5. feedback  — critique the deck itself (gaps/weaknesses/strengths)
 *   6. verdict   — the custom invest model
 *
 * Each stage lives with its product in `features/<product>/stage.ts` and runs
 * as soon as the stages it `needs` are done. Each field arrives as a live
 * `field` event; the API route and UI only depend on `DueDiligenceForm` +
 * `ProgressEvent`.
 */
const STAGES: PipelineStage[] = [
  extractStage,
  landscapeStage,
  researchStage,
  completeStage,
  scorecardStage,
  feedbackStage,
  verdictStage,
];

class PipelineDiligenceEngine implements DiligenceEngine {
  async run(
    input: DiligenceInput,
    onEvent?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<DueDiligenceForm> {
    const emit: ProgressCallback = onEvent ?? (() => {});
    const form = emptyForm();

    await runStages(STAGES, (stageSignal) => ({ input, form, emit, signal: stageSignal, research: null }), signal);

    form.generatedAt = new Date().toISOString();
    emit({ type: "status", phase: "done", message: "Report ready" });
    return form;
  }
}

/** Single entry point used by the API route. */
export function getDiligenceEngine(): DiligenceEngine {
  return new PipelineDiligenceEngine();
}
