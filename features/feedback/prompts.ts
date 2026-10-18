import { withDeckContext } from "@/lib/core/deck-context";
import type { ResearchResult } from "@/lib/core/types";
import type { SystemPrompt } from "@/lib/llm/types";
import { formatDeckChecklist } from "./checklist";

// ───────────────────────── Pass 5: deck feedback ─────────────────────────

/**
 * Standard slides/topics a VC expects in a pitch deck. Used as a guess-fill
 * backbone alongside the playbook (which is still thin) so feedback isn't
 * limited to what William has written down so far.
 *
 * Built from the shared list in `checklist.ts` so the homepage can show
 * founders the same ten items this stage actually grades against.
 */
const EXPECTED_DECK_CHECKLIST = formatDeckChecklist();

/**
 * Deck-critique stage. Reviews the deck (plus research signals) against
 * William's playbook and the standard expected-deck checklist, producing a
 * balanced list of strengths, warnings, and critical gaps — NOT a form field,
 * a qualitative review of the deck itself.
 */
export function buildDeckFeedbackSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You are given a startup's pitch deck (above) plus research notes gathered about the company (in the user message below). Write a BALANCED critique of the PITCH DECK ITSELF (not the company's prospects) as if advising the founder on what to fix before sending it to investors.

Cover three kinds of items:
- "strength" - something the deck does well and should keep (e.g. a sharp competitors slide, discoverable founders).
- "warning" - something present but thin, vague, or weak (e.g. traction claims with no numbers).
- "critical" - something important missing entirely, or a claim research contradicts.

Ground your critique in TWO layers, in priority order:
1. The playbook above - this is William's real internal evaluation framework. Apply it first and specifically (e.g. founder discoverability, competitive positioning, deck basics).
2. Where the playbook doesn't cover a topic, fall back to this standard checklist of what a deck should contain:
${EXPECTED_DECK_CHECKLIST}

Use the research notes to sharpen critical/warning items whenever they reveal something the deck alone wouldn't show - e.g. founders who can't be verified online, traction or market claims the research contradicts or can't confirm. Don't just restate what's in the deck; say something the research adds. If the research notes report weak or absent web visibility (no press, no discoverable founders, no funding data), reflect that honestly as its own item - it's a real diligence signal for early-stage decks, not a reason to omit it.

## Output format - STRICT
Output ONLY a sequence of JSON objects, ONE PER LINE (NDJSON). No prose, no markdown fences, no surrounding array — just one JSON object per line. Each line must be:
{"severity": "<critical|warning|strength>", "category": "<short category, e.g. Team, Competition, Market, Deck Basics>", "title": "<short label, under 8 words>", "detail": "<1-2 sentences of explanation>"}
Rules:
- Emit 5-10 items total, mixing severities - do not emit only critical items.
- Be specific to THIS deck. Do not fabricate facts; ground every item in the deck text or research notes.
- Do NOT use em-dashes (—) or en-dashes (–) in any of the fields (title, detail, category); use a regular hyphen (-) instead.
- Output nothing except the JSON lines.`,
  );
}

export function buildDeckFeedbackUserPrompt(research: ResearchResult): string {
  return `## Research notes
${research.findings || "(no external findings were gathered)"}

Now output the deck feedback as NDJSON.`;
}
