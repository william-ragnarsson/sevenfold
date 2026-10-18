import { providerFor, reportUsage } from "@/lib/core/llm";
import { getLandscapeModel, getLandscapeThinking, getResearchMaxSearches } from "@/lib/config";
import type { PipelineStage } from "@/lib/diligence/types";
import { landscapeFailure, parseLandscape, UnreadableMap } from "./parse";
import {
  buildLandscapeMapSystemPrompt,
  buildLandscapeMapUserPrompt,
  buildLandscapeResearchSystemPrompt,
  buildLandscapeResearchUserPrompt,
  LANDSCAPE_MAP_SCHEMA,
} from "./prompts";

/**
 * Competitive landscape stage: research the competitors, then map them on the
 * two axes that matter most in this market. Two calls rather than one, because
 * web-search answers come back as cited fragments that don't survive being
 * asked for JSON; the second call turns the prose notes into the grid.
 *
 * Needs only the deck and the company name, so it runs alongside the main
 * research pass. Its searches go out as their own landscape-search/
 * landscape-source events, shown on the landscape card while it works; as
 * plain search/source events, interleaved with the main research pass, they'd
 * scramble the Web Search tab's query → sources grouping. Non-critical: a
 * failure is reported and swallowed, so a missing landscape never costs the
 * investor the rest of the report.
 */
export const landscapeStage: PipelineStage = {
  id: "landscape",
  needs: ["extract"],
  critical: false,
  async run({ input, form, emit, signal }) {
    const model = getLandscapeModel();
    const thinking = getLandscapeThinking();
    const provider = providerFor(model);
    // The startup's name from the deck pass ("" if the deck didn't say).
    const companyName = form.company.name.value;

    const research = await provider.researchWeb({
      model,
      system: buildLandscapeResearchSystemPrompt(input.playbook, input.deckText),
      user: buildLandscapeResearchUserPrompt(companyName, getResearchMaxSearches()),
      onSearch: (query) => emit({ type: "landscape-search", query }),
      onSource: ({ title, url }) => emit({ type: "landscape-source", title, url }),
      onUsage: reportUsage(emit, "landscape-search"),
      thinking,
      signal,
    });
    signal.throwIfAborted();

    const text = await provider.generateStream({
      model,
      system: buildLandscapeMapSystemPrompt(input.playbook, input.deckText),
      user: buildLandscapeMapUserPrompt(companyName, research.findings, research.sources),
      onUsage: reportUsage(emit, "landscape"),
      thinking,
      jsonSchema: LANDSCAPE_MAP_SCHEMA,
      signal,
    });

    signal.throwIfAborted(); // the run may have ended while this was in flight
    const landscape = parseLandscape(text, research.sources, companyName);
    if (!landscape) throw new UnreadableMap();
    form.landscape = landscape;
    emit({ type: "landscape", landscape });
  },
  onError(err, { emit }) {
    console.warn("[landscape] failed, skipping it:", err instanceof Error ? err.message : err);
    emit({ type: "landscape-failed", message: landscapeFailure(err) });
  },
};
