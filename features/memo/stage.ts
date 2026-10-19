import { fillFields } from "@/lib/core/fill-fields";
import { researchOf } from "@/lib/core/stage";
import { getCompleteModel, getCompleteThinking, getExtractModel, getExtractThinking } from "@/lib/config";
import { applyField, FIELD_DESCRIPTORS } from "@/lib/diligence/form-schema";
import type { PipelineStage } from "@/lib/diligence/types";
import {
  buildCompleteSystemPrompt,
  buildCompleteUserPrompt,
  buildDeckExtractSystemPrompt,
  buildDeckExtractUserPrompt,
} from "./prompts";

/**
 * Fill what the deck says (fast, deck-sourced). Covers every field in the
 * report's registry, the founders and the scorecard included, so one cached
 * pass reads the whole deck.
 */
export const extractStage: PipelineStage = {
  id: "extract",
  needs: [],
  status: { phase: "extracting", message: "Reading the deck" },
  run: ({ input, form, emit, signal }) =>
    fillFields({
      model: getExtractModel(),
      system: buildDeckExtractSystemPrompt(input.playbook, input.deckText, FIELD_DESCRIPTORS),
      user: buildDeckExtractUserPrompt(),
      apply: (key, value, source) => applyField(form, key, value, source),
      emit,
      stage: "extract",
      thinking: getExtractThinking(),
      signal,
    }),
};

/** Fill the gaps the deck left, from the research notes (web-sourced). */
export const completeStage: PipelineStage = {
  id: "complete",
  needs: ["research"],
  status: { phase: "completing", message: "Completing the form" },
  run: (ctx) =>
    fillFields({
      model: getCompleteModel(),
      system: buildCompleteSystemPrompt(ctx.input.playbook, ctx.input.deckText, FIELD_DESCRIPTORS),
      user: buildCompleteUserPrompt(researchOf(ctx)),
      apply: (key, value, source) => applyField(ctx.form, key, value, source),
      emit: ctx.emit,
      stage: "complete",
      thinking: getCompleteThinking(),
      signal: ctx.signal,
    }),
};
