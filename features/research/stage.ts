import { providerFor, reportUsage } from "@/lib/core/llm";
import { getResearchModel } from "@/lib/config";
import { computeGaps } from "@/lib/diligence/form-schema";
import type { PipelineStage } from "@/lib/diligence/types";
import { buildSearchSystemPrompt, buildSearchUserPrompt } from "./prompts";

/**
 * Web research — a single web-search pass against the shared, cached
 * deck+playbook context, targeting the fields the deck left empty. The
 * provider's web search collects and organizes source-attributed research
 * notes directly (no separate synthesis call), forwarding query/source/notes
 * as events. The notes feed the completion, scorecard, and feedback stages
 * as-is, through `ctx.research`.
 */
export const researchStage: PipelineStage = {
  id: "research",
  needs: ["extract"],
  status: { phase: "researching", message: "Researching online" },
  async run(ctx) {
    const { input, form, emit, signal } = ctx;
    const model = getResearchModel();
    const result = await providerFor(model).researchWeb({
      model,
      system: buildSearchSystemPrompt(input.playbook, input.deckText),
      user: buildSearchUserPrompt(form.company.name.value, computeGaps(form)),
      onSearch: (query) => emit({ type: "search", query }),
      onSource: (source) => emit({ type: "source", ...source }),
      onText: (text) => emit({ type: "note", text }),
      onUsage: reportUsage(emit, "search"),
      signal,
    });
    ctx.research = { findings: result.findings, sources: result.sources };
    form.sources = result.sources;
  },
};
