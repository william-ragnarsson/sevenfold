import { withDeckContext } from "@/lib/core/deck-context";
import type { SystemPrompt } from "@/lib/llm/types";

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
