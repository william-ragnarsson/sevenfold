import { computeGaps, emptyForm } from "@/lib/diligence/form-schema";
import { fillFields } from "@/lib/diligence/fill-fields";
import { scoreCard } from "@/lib/diligence/score";
import { reviewDeck } from "@/lib/diligence/feedback";
import { landscapeFailure, mapLandscape } from "@/lib/diligence/landscape";
import { research } from "@/lib/diligence/research";
import {
  getCompleteModel,
  getExtractModel,
  getFeedbackModel,
  getLandscapeModel,
  getScorecardModel,
} from "@/lib/config";
import {
  buildCompleteSystemPrompt,
  buildCompleteUserPrompt,
  buildDeckExtractSystemPrompt,
  buildDeckExtractUserPrompt,
} from "@/lib/diligence/prompt";
import { predictInvest } from "@/lib/invest/model";
import type {
  DiligenceEngine,
  DiligenceInput,
  DueDiligenceForm,
  ProgressCallback,
} from "@/lib/diligence/types";

/**
 * The diligence pipeline, all stages streaming into one live-filling form:
 *   1. extract   — fill what the deck says (fast, deck-sourced)
 *   2. research  — web search to verify/augment (search/source/note events)
 *      landscape — map the competitors on a two-axis grid, in parallel with
 *                  2–4 (non-critical: a failure leaves it null)
 *   3. complete  — fill the gaps (web-sourced)
 *   4. scorecard — the seven ratings the invest model reads
 *   5. review    — critique the deck itself (gaps/weaknesses/strengths)
 *   6. verdict   — the custom invest model
 *
 * Each field arrives as a live `field` event; the API route and UI only depend
 * on `DueDiligenceForm` + `ProgressEvent`.
 */
class PipelineDiligenceEngine implements DiligenceEngine {
  async run(
    input: DiligenceInput,
    onEvent?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<DueDiligenceForm> {
    const emit: ProgressCallback = onEvent ?? (() => {});
    const form = emptyForm();

    // 1. Extract everything derivable from the deck.
    emit({ type: "status", phase: "extracting", message: "Reading the deck" });
    await fillFields({
      model: getExtractModel(),
      system: buildDeckExtractSystemPrompt(input.playbook, input.deckText),
      user: buildDeckExtractUserPrompt(),
      form,
      emit,
      stage: "extract",
      signal,
    });
    signal?.throwIfAborted();

    // The competitive landscape needs only the deck and the company name, so it
    // runs alongside everything below instead of adding to the wall clock. It
    // has its own controller so a failure further down the pipeline stops it
    // too, and its own failures are reported and swallowed: a missing
    // landscape never costs the investor the rest of the report.
    const landscapeCtl = new AbortController();
    const landscapeSignal = signal ? AbortSignal.any([signal, landscapeCtl.signal]) : landscapeCtl.signal;
    let landscapePending = true;
    const landscape = mapLandscape({
      model: getLandscapeModel(),
      deckText: input.deckText,
      playbook: input.playbook,
      companyName: form.company.name.value,
      form,
      emit,
      signal: landscapeSignal,
    })
      .catch((err) => {
        if (landscapeSignal.aborted) return;
        console.warn("[landscape] failed, skipping it:", err instanceof Error ? err.message : err);
        emit({ type: "landscape-failed", message: landscapeFailure(err) });
      })
      .finally(() => {
        landscapePending = false;
      });

    try {
      // 2. Research the web, targeting the fields the deck left empty.
      emit({ type: "status", phase: "researching", message: "Researching online" });
      const researchResult = await research(
        input,
        onEvent,
        { companyName: form.company.name.value, gaps: computeGaps(form) },
        signal,
      );
      form.sources = researchResult.sources;
      signal?.throwIfAborted();

      // 3. Complete the form with the findings.
      emit({ type: "status", phase: "completing", message: "Completing the form" });
      await fillFields({
        model: getCompleteModel(),
        system: buildCompleteSystemPrompt(input.playbook, input.deckText),
        user: buildCompleteUserPrompt(researchResult),
        form,
        emit,
        stage: "complete",
        signal,
      });
      signal?.throwIfAborted();

      // 4. Score the scorecard in its own dedicated pass — the sole input to the
      //    invest model, kept separate so it can't be truncated to empty.
      await scoreCard({
        model: getScorecardModel(),
        deckText: input.deckText,
        research: researchResult,
        playbook: input.playbook,
        form,
        emit,
        signal,
      });
      signal?.throwIfAborted();

      // 5. Critique the deck itself — gaps, weaknesses, and strengths, grounded
      //    in the playbook and research signals gathered above.
      emit({ type: "status", phase: "completing", message: "Reviewing the pitch deck" });
      await reviewDeck({
        model: getFeedbackModel(),
        deckText: input.deckText,
        research: researchResult,
        playbook: input.playbook,
        form,
        emit,
        signal,
      });
      signal?.throwIfAborted();

      // The landscape has usually finished by now; if not, wait for it so the
      // report goes out with it.
      if (landscapePending) {
        emit({ type: "status", phase: "completing", message: "Finishing the competitive landscape" });
      }
      await landscape;
      signal?.throwIfAborted();

      // 6. Investment verdict from the custom ONNX model.
      emit({ type: "status", phase: "verdict", message: "Running the investment model" });
      const verdict = await predictInvest(form.scorecard);
      form.verdict = verdict;
      emit({ type: "verdict", verdict });

      form.generatedAt = new Date().toISOString();
      emit({ type: "status", phase: "done", message: "Report ready" });
      return form;
    } finally {
      landscapeCtl.abort();
    }
  }
}

/** Single entry point used by the API route. */
export function getDiligenceEngine(): DiligenceEngine {
  return new PipelineDiligenceEngine();
}
