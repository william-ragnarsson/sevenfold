import { providerFor, reportUsage } from "@/lib/core/llm";
import { createLineBuffer } from "@/lib/core/parse";
import { researchOf } from "@/lib/core/stage";
import { getFeedbackModel, getFeedbackThinking } from "@/lib/config";
import type { PipelineStage } from "@/lib/diligence/types";
import { parseFeedbackLine } from "./parse";
import { buildDeckFeedbackSystemPrompt, buildDeckFeedbackUserPrompt } from "./prompts";

/**
 * Deck-critique stage. Streams an NDJSON list of feedback items — gaps,
 * weaknesses, and strengths in the pitch deck itself — grounded in the
 * playbook and the research findings. Runs after research + the form is
 * complete, so it can flag issues research surfaces (e.g. unverifiable
 * founders) as well as what's literally on the slides.
 */
export const feedbackStage: PipelineStage = {
  id: "feedback",
  needs: ["scorecard"],
  status: { phase: "completing", message: "Reviewing the pitch deck" },
  async run(ctx) {
    const { input, form, emit, signal } = ctx;
    const lines = createLineBuffer((line) => {
      const item = parseFeedbackLine(line);
      if (!item) return;
      form.deckFeedback.push(item);
      emit({ type: "feedback", item });
    });

    const model = getFeedbackModel();
    await providerFor(model).generateStream({
      model,
      system: buildDeckFeedbackSystemPrompt(input.playbook, input.deckText),
      user: buildDeckFeedbackUserPrompt(researchOf(ctx)),
      onText: lines.push,
      onUsage: reportUsage(emit, "feedback"),
      thinking: getFeedbackThinking(),
      signal,
    });

    // Flush any trailing line without a terminating newline.
    lines.flush();
  },
};
