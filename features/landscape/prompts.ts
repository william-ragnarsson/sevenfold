import { withDeckContext } from "@/lib/core/deck-context";
import type { Source } from "@/lib/core/types";
import type { JsonSchema, SystemPrompt } from "@/lib/llm/types";

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

const AXIS = {
  type: "object",
  properties: {
    label: { type: "string" },
    low: { type: "string" },
    high: { type: "string" },
    why: { type: "string" },
  },
  required: ["label", "low", "high", "why"],
};

const POSITION = { type: "integer", minimum: 0, maximum: 100 };

/**
 * The map reply's shape, for models that enforce one (Gemini). Matches the
 * format in the prompt above, keys in the same order. `parseLandscape` stays
 * lenient all the same, since Claude only has the prompt to go on.
 */
export const LANDSCAPE_MAP_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    xAxis: AXIS,
    yAxis: AXIS,
    summary: { type: "string" },
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          website: { type: "string" },
          x: POSITION,
          y: POSITION,
          subject: { type: "boolean" },
          description: { type: "string" },
          whyCompetitor: { type: "string" },
          contrast: { type: "string" },
          rank: { type: ["integer", "null"], minimum: 1, maximum: 3 },
        },
        required: ["name", "website", "x", "y", "subject", "description", "whyCompetitor", "contrast", "rank"],
      },
    },
  },
  required: ["xAxis", "yAxis", "summary", "companies"],
};

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
