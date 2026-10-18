import { withDeckContext } from "@/lib/core/deck-context";
import type { ResearchResult } from "@/lib/core/types";
import type { SystemPrompt } from "@/lib/llm/types";

// ───────────────────────── Pass 4: score the scorecard ─────────────────────────

/**
 * The scorecard is the SOLE input to the trained invest model, so it gets its
 * own dedicated stage: a single small JSON object, impossible to truncate, that
 * always produces all seven values. Definitions match William's rubric exactly.
 */
export function buildScorecardSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `Score this startup on William's seven-factor scorecard, using the deck (above) and the research notes (in the user message below) together. This is a judgment call - you always have enough to give your best estimate, so NEVER leave a value out.

Rate each of these 1-5 (1 = weak, 5 = exceptional):
- team - strength, completeness and track record of the founding team.
- technology - product/tech maturity. 1 = prototype / MVP / undeveloped, 5 = market-ready (shipping, productized).
- marketSize - size and growth of the addressable market.
- valueProposition - how compelling and differentiated the value to customers is.
- competitiveAdvantage - moat / defensibility versus competitors.
- socialImpact - positive social or environmental impact.

And one number:
- funding - the total amount of money the startup has ALREADY RAISED to date (sum of prior rounds / capital in), as a plain integer in US dollars (no symbols, no separators; convert other currencies at an approximate current rate). This is NOT the amount they are currently asking for. Use 0 only when the deck or research shows nothing has been raised yet (bootstrapped, pre-funding). If it's genuinely unknown, use null - the model treats "raised nothing" and "unknown" differently, so don't guess 0.

## Output format - STRICT
Output ONLY one JSON object, nothing else (no prose, no markdown fences):
{"team": <1-5>, "technology": <1-5>, "marketSize": <1-5>, "valueProposition": <1-5>, "competitiveAdvantage": <1-5>, "socialImpact": <1-5>, "funding": <integer or null>}`,
  );
}

export function buildScorecardUserPrompt(research: ResearchResult): string {
  return `## Research notes
${research.findings || "(no external findings were gathered)"}

Now output the scorecard JSON object.`;
}
