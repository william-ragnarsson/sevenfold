import type { TokenUsage } from "./types";

/**
 * $ per token, by model, and how its web searches bill. The single place to
 * update when a model or its price changes — `costOf` just looks up the row
 * and does the arithmetic.
 */
interface Rate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  search: SearchRate;
}

/**
 * How a model's web searches bill, at list price. "query": every search the
 * model runs. "prompt": once per call that searched at all, however many
 * searches it ran.
 */
interface SearchRate {
  usd: number;
  per: "query" | "prompt";
}

// Free search allowances aren't subtracted. They're shared by everything on the
// API key (Gemini 3.x's across all 3.x models), and nothing here can see how
// much is left, so the tracked cost is what the searches cost once they're
// used up: an upper bound, never an undercount.

/** Claude's web_search tool: $10 per 1,000 searches. */
const CLAUDE_SEARCH: SearchRate = { usd: 0.01, per: "query" };
/** Gemini 3.x: 5,000 queries a month free, then $14 per 1,000 queries. */
const GEMINI_3_SEARCH: SearchRate = { usd: 0.014, per: "query" };
/** Gemini 2.5: 1,500 grounded prompts a day free, then $35 per 1,000 prompts. */
const GEMINI_2_5_SEARCH: SearchRate = { usd: 0.035, per: "prompt" };

// Keep this in sync with KNOWN_MODELS in lib/config.ts — every model the user
// can select in .env should have a row here so per-stage cost tracking works.
const PER_MILLION: Record<string, Rate> = {
  // Claude rates are Anthropic's list prices (platform.claude.com/docs/en/about-claude/pricing);
  // cacheWrite is the 5-minute cache write, the only kind claude.ts makes.
  "claude-opus-4-8": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25, search: CLAUDE_SEARCH },
  // Sonnet 5's $2 / $10 launch price became its standard price; the rise to
  // $3 / $15 announced for 2026-09-01 was called off.
  "claude-sonnet-5": { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5, search: CLAUDE_SEARCH },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75, search: CLAUDE_SEARCH },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25, search: CLAUDE_SEARCH },
  // Gemini rates are Google's paid-tier list prices (ai.google.dev/gemini-api/docs/pricing),
  // copied by hand, not fetched live — update if the rate card changes. Gemini
  // has no explicit cache-write charge, so cacheWrite mirrors the input rate as a
  // conservative upper bound. Output includes thinking: Google bills it at the
  // output rate.
  // TODO(2027-01-01): 3.6 Flash's introductory price ends; it becomes 1.50 / 7.50 / 0.15.
  "gemini-3.6-flash": { input: 0.75, output: 3.75, cacheRead: 0.075, cacheWrite: 0.75, search: GEMINI_3_SEARCH },
  "gemini-3.5-flash": { input: 1.5, output: 9.0, cacheRead: 0.15, cacheWrite: 1.5, search: GEMINI_3_SEARCH },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0.3, search: GEMINI_3_SEARCH },
  // Google shuts 3.1 Flash-Lite down on 2027-05-07.
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5, cacheRead: 0.025, cacheWrite: 0.25, search: GEMINI_3_SEARCH },
  "gemini-2.5-flash": { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0.3, search: GEMINI_2_5_SEARCH },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4, cacheRead: 0.01, cacheWrite: 0.1, search: GEMINI_2_5_SEARCH },
};

/** $ for the web searches one call ran. */
function searchCostOf(searches: number, rate: SearchRate): number {
  if (searches <= 0) return 0;
  return rate.per === "prompt" ? rate.usd : searches * rate.usd;
}

export function costOf(usage: TokenUsage): number {
  const rate = PER_MILLION[usage.model];
  if (!rate) return 0;

  const tokenCost =
    (usage.inputTokens * rate.input +
      usage.outputTokens * rate.output +
      usage.cacheReadTokens * rate.cacheRead +
      usage.cacheCreationTokens * rate.cacheWrite) /
    1_000_000;

  return tokenCost + searchCostOf(usage.webSearches ?? 0, rate.search);
}

/**
 * $ saved by reading `cacheReadTokens` from cache instead of paying the full
 * input rate for them. Zero for unknown models or when nothing was cached.
 */
export function cacheSavingsOf(usage: TokenUsage): number {
  const rate = PER_MILLION[usage.model];
  if (!rate) return 0;

  return (usage.cacheReadTokens * (rate.input - rate.cacheRead)) / 1_000_000;
}
