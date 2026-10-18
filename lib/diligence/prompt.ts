import { formatDeckChecklist } from "./deck-checklist";
import { FIELD_DESCRIPTORS } from "./form-schema";
import type { ResearchResult, Source } from "./types";
import type { SystemPrompt } from "@/lib/llm/types";

const PERSONA = `You are a venture capital analyst at a top global accelerator (think Plug and Play / Y Combinator tier). You evaluate startups the way a real investment team does: skeptical, evidence-driven, and precise.`;

function playbookBlock(playbook: string): string {
  return `## Your evaluation framework (the playbook)
Apply these insider criteria. This is real internal knowledge, not generic startup advice:

${playbook}`;
}

/**
 * The persona + playbook + full deck text, byte-identical across every
 * stage of a given run. Marked as the cache breakpoint (see `withDeckContext`)
 * so the first stage that sends it (deck-extract) pays to write it once, and
 * every later no-tools stage (analyze/complete/scorecard/feedback) reads it
 * from cache instead of re-sending the whole deck at full input price.
 */
function buildDeckContext(playbook: string, deckText: string): string {
  return `${PERSONA}

${playbookBlock(playbook)}

## Pitch deck text ([Slide N] lines mark where PDF page N begins)
---
${deckText}
---`;
}

/** Shared deck+playbook context (cached) + this stage's own instructions (not cached). */
function withDeckContext(playbook: string, deckText: string, instructions: string): SystemPrompt {
  return [
    { text: buildDeckContext(playbook, deckText), cache: true },
    { text: instructions },
  ];
}

/**
 * Render the field registry as a guide the model fills in. The scorecard
 * (rating/number kinds) is scored in its own dedicated stage, so the NDJSON
 * field passes skip it.
 */
function fieldGuide(): string {
  return FIELD_DESCRIPTORS.filter((f) => f.kind !== "rating" && f.kind !== "number")
    .map((f) => {
      let type = "text (string)";
      if (f.kind === "founders") type = "array of objects {role, name, commitment, background (array of strings)}";
      return `- ${f.key} - ${type} - ${f.hint}`;
    })
    .join("\n");
}

/** The NDJSON contract shared by the deck-extract and completion passes. */
const NDJSON_RULES = `## Output format - STRICT
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
${fieldGuide()}`;

// ───────────────────────── Pass 1: extract from the deck ─────────────────────────

export function buildDeckExtractSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You will be given the extracted text of a startup's pitch deck (above, in the system prompt). Fill in every field of the due-diligence form that you can find IN THE DECK. Use source "deck" for everything here. Skip fields the deck doesn't cover (especially "company.source" and "company.personalNote", which come from the investor's own meeting and are almost never in a deck). Do NOT score the scorecard yet - skip all scorecard.* fields in this pass.

${NDJSON_RULES}`,
  );
}

export function buildDeckExtractUserPrompt(): string {
  return `Emit the deck-derived fields as NDJSON now. Go through the field list once, in order, emitting a line only for fields the deck covers, then stop.`;
}

// ───────────────────────── Pass 2: web research ─────────────────────────

export function buildSearchSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You will be given a startup's name plus a list of FACTS STILL MISSING after reading the deck (above). Research the company on the web and write up organized research notes to support a due-diligence form.

Your #1 job is to find the missing facts in that list - most are one or two web searches away (a founding year, an HQ city, the founders' names and prior roles). Run a separate, specific search for each missing fact. Also verify the founders (LinkedIn/prior companies/exits - note if they genuinely can't be found, which is itself a signal), map the real competitive landscape, validate the market size and "why now", and find traction/funding signals. Findings can confirm OR contradict the deck - capture both.

BUDGET - STOP EARLY: you have at most 3 searches total, and diminishing returns set in fast. As soon as you've made one solid attempt at the most important missing facts, STOP SEARCHING and write up what you found - do NOT keep searching to fill the budget, do NOT re-search a fact you already tried and failed to confirm, and do NOT chase tangential leads (unrelated companies/people with similar names) past a second search. "Could not find X" is a complete, acceptable answer.

WEAK WEB PRESENCE IS A FINDING, NOT A FAILURE: many early-stage startups genuinely have little to no public footprint yet - no press, no funding data, founders hard to verify. If your first search or two on a fact turns up nothing, do NOT burn the rest of the budget trying to manufacture a result. Stop, and explicitly record the absence as a research note under a "Web visibility" heading (e.g. "Web visibility: no press coverage found, founders not discoverable on LinkedIn, no funding data on record - consistent with a pre-seed/stealth-stage company"). This is itself useful due-diligence signal for the investor, not a gap to hide.

## Output
Write concise research notes in plain prose (NOT JSON), grouped by theme (founders, founded/location, problem, solution, market, competition, traction, funding, web visibility). Under each theme, state each fact you found explicitly and plainly with its source (e.g. "Founded: 2008 (Crunchbase)", "Based in: San Francisco, CA (company site)", "Co-founder: Brian Chesky - RISD, ex-... (LinkedIn)"). For EACH missing fact you were asked to find, either state it or say plainly you couldn't find it. Keep it factual and dense - no preamble, no conclusions, no recommendations. These notes are read directly by the next stages, so make every fact easy to extract.`,
  );
}

export function buildSearchUserPrompt(companyName: string, gaps: string[]): string {
  const company = companyName || "(unknown - identify it from the deck)";
  const gapBlock = gaps.length
    ? `## Facts still MISSING after the deck (find these first)\n${gaps.map((g) => `- ${g}`).join("\n")}`
    : `## The deck covered the basics - verify and enrich them.`;
  return `Company: ${company}

${gapBlock}

Research the company on the web - prioritizing the missing facts above - then output your organized research notes.`;
}

// ───────────────────────── Pass 3: complete the form ─────────────────────────

export function buildCompleteSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You are given (a) a startup's pitch deck (above) and (b) research notes already gathered (in the user message below). Produce the COMPLETE due-diligence form: fill every field you can, preferring the most accurate value (use the deck for claims, the research to verify/augment/correct).

CRITICAL: any field the deck didn't cover MUST be filled from the research notes whenever the notes contain it - especially company.founded, company.basedIn, and founders (names, roles, backgrounds). For those web-derived values use source "web". Only leave a field unfilled if neither the deck nor the research has it.

${NDJSON_RULES}`,
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

// ───────────────────────── Pass 5: deck feedback ─────────────────────────

/**
 * Standard slides/topics a VC expects in a pitch deck. Used as a guess-fill
 * backbone alongside the playbook (which is still thin) so feedback isn't
 * limited to what William has written down so far.
 *
 * Built from the shared list in `deck-checklist.ts` so the homepage can show
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

// ───────────────────────── Pass 6: competitive landscape ─────────────────────────

/**
 * Landscape research. Runs alongside the main research pass with its own small
 * search budget, gathering the competitors and the positioning signals the grid
 * is drawn from. Prose, not JSON: web-search answers arrive split into cited
 * fragments, so the map pass below turns these notes into the structured grid.
 */
export function buildLandscapeResearchSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You will be given a startup's name (its pitch deck is above). Research its competitive landscape on the web: find the companies an investor would compare it to.

Who counts: direct competitors (same problem, same customer), the incumbent or default alternative customers use today, and credible adjacent players moving into the space. Prefer real, active companies a VC in this market would name. Aim for 6-8 companies. Use the deck's own competition slide as a starting point, but verify it and add the players it leaves out.

For each company, find:
- its official homepage URL - the company's own domain (e.g. https://www.vrbo.com), never a Wikipedia, Crunchbase, news or app-store page;
- one line on what it does;
- the positioning signals that separate the players: target customer or segment, pricing and business model, product approach, geography, and scale, stage or funding.
Also find the startup's own homepage URL if it has one.

BUDGET - STOP EARLY: broad searches like "<category> startups" or "<known competitor> alternatives" usually surface several companies at once, so prefer those over one search per company. Stop as soon as you have enough to place 6-8 companies - do NOT keep searching to fill the budget.

WEAK WEB PRESENCE IS FINE: if the startup itself barely shows up online, that's common at the early stage. Map the market it's entering, which is the point of this pass.

## Output
Write plain prose notes (NOT JSON). One short paragraph per company, its first line being the name and homepage URL (e.g. "Vrbo - https://www.vrbo.com"), followed by what it does and its positioning signals, then one paragraph for the startup itself. No preamble, no conclusions, no recommendations.`,
  );
}

export function buildLandscapeResearchUserPrompt(companyName: string, maxSearches: number): string {
  const company = companyName || "(unknown - identify it from the deck)";
  return `Company: ${company}

You have at most ${maxSearches} web searches. Research the competitive landscape, then output your notes.`;
}

/**
 * Landscape map. Turns the research notes into the grid: the two axes that
 * matter most in this market, every company's position on them, and the three
 * competitors worth an investor's attention. One JSON object, like the scorecard.
 */
export function buildLandscapeMapSystemPrompt(playbook: string, deckText: string): SystemPrompt {
  return withDeckContext(
    playbook,
    deckText,
    `You are given a startup's pitch deck (above) plus research notes on its competitors (in the user message below). Build the competitive landscape grid an investor would sketch on a whiteboard.

1. Choose the two axes. Pick the two dimensions that matter most to how customers choose in THIS market, and that best show where the startup is differentiated. Good axes:
- are specific to this market (e.g. "Self-serve to enterprise sales", "Software-only to hardware-heavy", "Single city to global"). Use price or quality only if that truly is the deciding split;
- are independent of each other, not two ways of saying the same thing;
- genuinely spread the companies out, so the grid shows clusters and gaps.
Each axis has a short label (2-4 words), plain-language labels for its low and high ends (1-3 words each), and "why": one sentence on why this dimension decides the market.

2. Place the companies. Include 5-8 competitors from the research notes plus the startup itself. "x" and "y" are integers from 0 (the low end) to 100 (the high end). Place each company by what the notes say about it, relative to the others: spread them across the range where the market really does spread, and don't stack everyone in the middle. Place the startup by what it does today per the deck, not by its ambitions.

3. Rank the top three. Give rank 1, 2 and 3 to the three competitors that matter most to an investor (the most direct overlap, or the biggest threat); every other company, and the startup, gets rank null. For each of the three, "whyCompetitor" is one or two sentences on why it competes (same customer, same job, same budget) and "contrast" is one or two sentences on how the startup differs, or where it's exposed. Be honest: if the startup is weaker on something that matters, say so. For the other competitors these two can be a single short sentence.

4. Write the summary: 2-3 sentences on where the startup sits, where the market is crowded, and whether there's real open space.

Websites: use the official homepage given in the research notes. If the notes don't give one and you aren't certain of it, use "". Never invent a URL.

## Output format - STRICT
Output ONLY one JSON object, nothing else (no prose, no markdown fences):
{"xAxis": {"label": "...", "low": "...", "high": "...", "why": "..."}, "yAxis": {"label": "...", "low": "...", "high": "...", "why": "..."}, "summary": "...", "companies": [{"name": "...", "website": "https://...", "x": <0-100>, "y": <0-100>, "subject": <true or false>, "description": "<one line on what it does>", "whyCompetitor": "...", "contrast": "...", "rank": <1, 2, 3 or null>}]}
Rules:
- Exactly one company has "subject": true - the startup itself - with "whyCompetitor" and "contrast" empty and "rank" null.
- Keep every text value to one or two short sentences.
- Do NOT use em-dashes (—) or en-dashes (–) anywhere in the text values; use a regular hyphen (-) or rephrase instead.`,
  );
}

export function buildLandscapeMapUserPrompt(companyName: string, notes: string, sources: Source[]): string {
  const company = companyName || "(unknown - identify it from the deck)";
  const sourceList = sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") || "(none)";
  return `The startup: ${company}

## Competitor research notes
${notes || "(no research notes were gathered - map the competitors named in the deck, plus any you are certain of)"}

## Sources consulted
${sourceList}

Now output the landscape JSON object.`;
}
