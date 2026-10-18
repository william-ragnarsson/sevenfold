import { providerFor, reportUsage } from "@/lib/core/llm";
import { extractObject } from "@/lib/core/parse";
import { researchOf } from "@/lib/core/stage";
import { getScorecardModel } from "@/lib/config";
import { applyField } from "@/lib/diligence/form-schema";
import type { PipelineStage } from "@/lib/diligence/types";
import { buildScorecardSystemPrompt, buildScorecardUserPrompt } from "./prompts";

const METRICS = [
  "team",
  "technology",
  "marketSize",
  "valueProposition",
  "competitiveAdvantage",
  "socialImpact",
  "funding",
] as const;

/**
 * Dedicated scorecard stage. The scorecard is the only input to the trained
 * invest model, so it can't be allowed to silently come back empty (which is
 * what happened when it rode along at the tail of the long completion stream and
 * got truncated). Here it's a single small JSON object — fast and untruncatable —
 * and every metric is written onto the form and emitted as a live `field` event.
 */
export const scorecardStage: PipelineStage = {
  id: "scorecard",
  needs: ["complete"],
  async run(ctx) {
    const { input, form, emit, signal } = ctx;
    const model = getScorecardModel();
    const text = await providerFor(model).generateStream({
      model,
      system: buildScorecardSystemPrompt(input.playbook, input.deckText),
      user: buildScorecardUserPrompt(researchOf(ctx)),
      onUsage: reportUsage(emit, "scorecard"),
      signal,
    });

    const obj = extractObject(text);
    if (!obj) return; // leave the scorecard at zero; verdict will read it as-is.

    for (const metric of METRICS) {
      if (obj[metric] === undefined || obj[metric] === null) continue;
      const key = `scorecard.${metric}`;
      if (applyField(form, key, obj[metric], "inferred")) {
        const value = (form.scorecard as unknown as Record<string, number>)[metric];
        emit({ type: "field", key, value, source: "inferred" });
      }
    }
  },
};
