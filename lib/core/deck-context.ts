import type { SystemPrompt } from "@/lib/llm/types";

/**
 * The shared, cached front of every stage's system prompt. Products write only
 * their own instructions and wrap them with `withDeckContext`.
 */

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

/**
 * Shared deck+playbook context (cached) + this stage's own instructions (not
 * cached). Never change the context per stage: every stage must send the same
 * bytes, or the cache misses and each one pays for the whole deck again.
 */
export function withDeckContext(playbook: string, deckText: string, instructions: string): SystemPrompt {
  return [
    { text: buildDeckContext(playbook, deckText), cache: true },
    { text: instructions },
  ];
}
