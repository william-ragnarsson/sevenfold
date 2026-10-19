import { withDeckContext } from "@/lib/core/deck-context";
import type { FieldDescriptor } from "@/lib/core/schema";
import type { ResearchResult } from "@/lib/core/types";
import type { SystemPrompt } from "@/lib/llm/types";

/**
 * The memo's two NDJSON field passes. Both fill every text field of the report
 * (founders included), so the stage passes in the whole field registry.
 */

/**
 * Render the field registry as a guide the model fills in. The scorecard
 * (rating/number kinds) is scored in its own dedicated stage, so the NDJSON
 * field passes skip it.
 */
function fieldGuide(fields: readonly FieldDescriptor[]): string {
  return fields.filter((f) => f.kind !== "rating" && f.kind !== "number")
    .map((f) => {
      let type = "text (string)";
      if (f.kind === "founders") type = "array of objects {role, name, commitment, background (array of strings)}";
      return `- ${f.key} - ${type} - ${f.hint}`;
    })
    .join("\n");
}

/** The NDJSON contract shared by the deck-extract and completion passes. */
function ndjsonRules(fields: readonly FieldDescriptor[]): string {
  return `## Output format - STRICT
Output ONLY a sequence of JSON objects, ONE PER LINE (NDJSON). No prose, no markdown fences, no surrounding array - just one JSON object per line. Each line must be:
{"key": "<field key>", "value": <value>, "source": "<deck|web|inferred|unknown>"}
Rules:
- Emit the fields in the order listed below, EACH KEY AT MOST ONCE.
- For text fields "value" is a string; for "founders" it is the JSON array.
- "source": "deck" if it came from the pitch deck, "web" if from research, "inferred" if you reasoned it, "unknown" if you genuinely don't have it.
- "slides": for a "deck" value, when the deck text has [Slide N] lines, also add "slides": [N, ...] with the 1-3 slide numbers the value comes from, e.g. {"key": "company.basedIn", "value": "San Francisco, CA", "source": "deck", "slides": [2]}. Only cite numbers that appear as [Slide N] lines. Leave "slides" out for any other source, or when the deck has no [Slide N] lines.
- Do NOT fabricate. If a field can't be filled, skip it (don't emit a line).
- Keep text values concise and specific (1-4 sentences). Output nothing except the JSON lines.
- Do NOT use em-dashes (—) or en-dashes (–) anywhere in the text values; use a regular hyphen (-) or rephrase instead.
- STOP as soon as you've gone through the field list once - do not repeat a key, do not loop back to the start, do not pad with extra lines.

## Fields
${fieldGuide(fields)}`;
}

// ───────────────────────── Pass 1: extract from the deck ─────────────────────────

export function buildDeckExtractSystemPrompt(
  playbook: string,
  deckText: string,
  fields: readonly FieldDescriptor[],
): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You will be given the extracted text of a startup's pitch deck (above, in the system prompt). Fill in every field of the due-diligence form that you can find IN THE DECK. Use source "deck" for everything here. Skip fields the deck doesn't cover (especially "company.source" and "company.personalNote", which come from the investor's own meeting and are almost never in a deck). Do NOT score the scorecard yet - skip all scorecard.* fields in this pass.

${ndjsonRules(fields)}`,
  );
}

export function buildDeckExtractUserPrompt(): string {
  return `Emit the deck-derived fields as NDJSON now. Go through the field list once, in order, emitting a line only for fields the deck covers, then stop.`;
}

// ───────────────────────── Pass 3: complete the form ─────────────────────────

export function buildCompleteSystemPrompt(
  playbook: string,
  deckText: string,
  fields: readonly FieldDescriptor[],
): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You are given (a) a startup's pitch deck (above) and (b) research notes already gathered (in the user message below). Produce the COMPLETE due-diligence form: fill every field you can, preferring the most accurate value (use the deck for claims, the research to verify/augment/correct).

CRITICAL: any field the deck didn't cover MUST be filled from the research notes whenever the notes contain it - especially company.founded, company.basedIn, and founders (names, roles, backgrounds). For those web-derived values use source "web". Only leave a field unfilled if neither the deck nor the research has it.

${ndjsonRules(fields)}`,
  );
}

export function buildCompleteUserPrompt(research: ResearchResult): string {
  const sourceList =
    research.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") || "(none)";
  return `## Research notes
${research.findings || "(no external findings were gathered)"}

## Sources consulted
${sourceList}

Go through the field list once, in order, emitting a line only for fields you can fill, then stop - now emit the complete form as NDJSON.`;
}
