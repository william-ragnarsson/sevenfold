/**
 * The single place the pipeline reads its configuration from. Everything here
 * is driven by environment variables (see `.env.example`) so models, the
 * web-research budget, and token caps can all be tuned without touching code.
 *
 * Every value is read at call time (not import time) and every knob has a
 * default that reproduces the current behaviour — so an empty `.env` behaves
 * exactly as the hardcoded defaults did, and the Vercel build stays green even
 * when a var isn't present at build.
 */

import type { Provider, ThinkingLevel } from "@/lib/llm/types";

// ───────────────────────────── API keys ─────────────────────────────

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env (see .env.example).",
    );
  }
  return key;
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env (see .env.example).",
    );
  }
  return key;
}

// ───────────────────────────── Supabase ─────────────────────────────
//
// Both are public by design (a publishable key is safe in the browser — Row-Level
// Security is what actually protects the data), so they're NEXT_PUBLIC_ and
// read directly in client components too. These getters exist for server code
// and to give one clear error message when the project isn't configured.
//
// The key is Supabase's `sb_publishable_…`, which replaces the legacy `anon` JWT.
// Never the `sb_secret_…` / `service_role` key: those bypass RLS, and nothing in
// this app needs to.

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env (see .env.example).",
    );
  }
  return url;
}

export function getSupabaseKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. Add it to .env (see .env.example).",
    );
  }
  return key;
}

/**
 * Whether Supabase is configured at all. Accounts and saved analyses are an
 * additive feature: with no project configured the app still runs analyses,
 * it just can't persist them. Callers use this to degrade instead of throw.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * The one deliberate exception to "never a secret key" above. Supabase's SDK
 * has no self-service "delete my own account" call — the only way to remove
 * an `auth.users` row is `auth.admin.deleteUser(id)`, which requires this key.
 * Used in exactly one place: `app/api/account/delete/route.ts`, via
 * `lib/supabase/admin.ts`. Deliberately NOT `NEXT_PUBLIC_` — never inline this
 * into the browser bundle, and never import `lib/supabase/admin.ts` from a
 * client component.
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env (see .env.example).",
    );
  }
  return key;
}

// ───────────────────────────── Models ─────────────────────────────

/**
 * The model ids the pipeline supports — the single source of truth for model
 * selection. To be usable a model MUST be listed here AND have a pricing row in
 * `lib/llm/pricing.ts`; `envModel` throws on anything else rather than passing
 * it through. This is deliberate: an unlisted id would otherwise run but track
 * as $0 (no pricing row) or, if mistyped, silently ride a stage's default. The
 * cost of the stricter contract is that a genuinely new model must be added to
 * both lists before use. Keep in sync with `PER_MILLION` and `.env.example`.
 */
export const KNOWN_MODELS = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

/** Which provider adapter a model id routes to — inferred from its name. */
export function deriveProvider(model: string): Provider {
  return model.trim().toLowerCase().startsWith("gemini") ? "gemini" : "claude";
}

/**
 * Claude models that reject `output_config.effort` outright (400 "This model
 * does not support the effort parameter"). A blocklist rather than an
 * allowlist so a newer/unrecognised model defaults to "supports it" — true
 * for every current-gen Claude model, Haiku 5.5 included.
 */
const EFFORT_UNSUPPORTED = new Set(["claude-haiku-4-5"]);

/** Whether it's safe to send `output_config.effort` to this model. */
export function modelSupportsEffort(model: string): boolean {
  return !EFFORT_UNSUPPORTED.has(model.trim().toLowerCase());
}

/**
 * Read a model id from `name`, falling back to `fallback` when unset. A set but
 * unrecognised value throws (see KNOWN_MODELS): the run stops immediately with a
 * clear message instead of silently running the wrong model or tracking as $0.
 */
function envModel(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!(KNOWN_MODELS as readonly string[]).includes(raw)) {
    throw new Error(
      `${name}="${raw}" is not a recognised model id. Set it to one of: ` +
        `${KNOWN_MODELS.join(", ")} (or unset it to use the default "${fallback}"). ` +
        `To add a new model, list it in KNOWN_MODELS (lib/config.ts) and add a ` +
        `pricing row in lib/llm/pricing.ts.`,
    );
  }
  return raw;
}

/**
 * Per-stage model selection. Claude Haiku 5.5, the cheapest Claude model at
 * $0.10 / $0.50 per million tokens in / out (5× that once a prompt passes 100K
 * tokens), on every stage except scorecard and feedback, which judge the deck
 * and get Claude Sonnet 5.5 ($2 / $10). Their prompts are small, so that adds
 * about 4¢ a run. Each stage can be pointed at any KNOWN_MODELS id from .env;
 * research gains the most from Sonnet next, and a `gemini-*` id routes to
 * Gemini (`lib/llm/gemini.ts`) with no other change. The presets in
 * `.env.example` price the combinations.
 */
export const getOcrModel = (): string => envModel("OCR_MODEL", "claude-haiku-5-5");
export const getExtractModel = (): string => envModel("EXTRACT_MODEL", "claude-haiku-5-5");
export const getResearchModel = (): string => envModel("RESEARCH_MODEL", "claude-haiku-5-5");
export const getCompleteModel = (): string => envModel("COMPLETE_MODEL", "claude-haiku-5-5");
export const getScorecardModel = (): string => envModel("SCORECARD_MODEL", "claude-sonnet-5-5");
export const getFeedbackModel = (): string => envModel("FEEDBACK_MODEL", "claude-sonnet-5-5");

/**
 * The competitive landscape stage, on Claude like the rest. Claude's web search
 * returns real page URLs, which the competitors' logos and links use. On a
 * Gemini model the sources come back as Google redirect links, so they rely on
 * the homepage the model writes into its notes. Any KNOWN_MODELS id works,
 * since the stage only talks to the generic provider interface.
 */
export const getLandscapeModel = (): string => envModel("LANDSCAPE_MODEL", "claude-haiku-5-5");

// ───────────────────────────── Thinking ─────────────────────────────

/** The thinking levels a stage can ask for, least to most. */
export const THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const satisfies readonly ThinkingLevel[];

/**
 * Read a stage's thinking level from `name`. Unset means "minimal", which each
 * model raises to its own minimum (the THINKING table in lib/llm/gemini.ts; on
 * Claude, effort low with thinking off where the model allows it, see
 * `thinkingParams` in lib/llm/claude.ts), so the default is always the
 * cheapest setting the stage's model accepts. A set but unrecognised value
 * throws, like `envModel`.
 */
function envThinking(name: string): ThinkingLevel {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return "minimal";
  if (!(THINKING_LEVELS as readonly string[]).includes(raw)) {
    throw new Error(
      `${name}="${raw}" is not a thinking level. Set it to one of: ` +
        `${THINKING_LEVELS.join(", ")} (or unset it for the model's minimum).`,
    );
  }
  return raw as ThinkingLevel;
}

/**
 * Per-stage thinking level, one per *_MODEL above. Thinking is billed as output
 * and comes out of the stage's output-token cap, so raise a stage only when its
 * answers need more reasoning than its model gives at the minimum. On Claude,
 * "low" and up turn adaptive thinking on at that effort.
 */
export const getOcrThinking = (): ThinkingLevel => envThinking("OCR_THINKING");
export const getExtractThinking = (): ThinkingLevel => envThinking("EXTRACT_THINKING");
export const getResearchThinking = (): ThinkingLevel => envThinking("RESEARCH_THINKING");
export const getCompleteThinking = (): ThinkingLevel => envThinking("COMPLETE_THINKING");
export const getScorecardThinking = (): ThinkingLevel => envThinking("SCORECARD_THINKING");
export const getFeedbackThinking = (): ThinkingLevel => envThinking("FEEDBACK_THINKING");
/** Both landscape calls: the competitor search and the map. */
export const getLandscapeThinking = (): ThinkingLevel => envThinking("LANDSCAPE_THINKING");

// ───────────────────────── Numeric knobs ─────────────────────────

/** Parse an int env var, clamping to [min, max] and warning on a bad value. */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    console.warn(`[config] ${name}="${raw}" is not an integer; using ${fallback}.`);
    return fallback;
  }
  const clamped = Math.min(max, Math.max(min, n));
  if (clamped !== n) {
    console.warn(`[config] ${name}=${n} is out of range [${min}, ${max}]; using ${clamped}.`);
  }
  return clamped;
}

/**
 * Web-research budget. `max searches` caps the web_search tool's uses; `max
 * continuations` caps how many times the server-side pause_turn loop resumes.
 *
 * NOTE: both gate Claude's `web_search` tool only, per call, where they're
 * hard caps on every search stage (research and landscape alike). Gemini's
 * Google Search grounding self-manages and never reads them, so a stage moved
 * to a Gemini model has the search cap only as a request in the landscape
 * prompt, and the continuation cap does nothing.
 */
export const getResearchMaxSearches = (): number => envInt("RESEARCH_MAX_SEARCHES", 3, 0, 10);
export const getResearchMaxContinuations = (): number =>
  envInt("RESEARCH_MAX_CONTINUATIONS", 3, 0, 10);

/** Advanced: max output tokens per stage class. */
export const getResearchMaxTokens = (): number => envInt("RESEARCH_MAX_TOKENS", 5000, 256, 128000);
export const getWriteMaxTokens = (): number => envInt("WRITE_MAX_TOKENS", 16000, 256, 128000);
export const getOcrMaxTokens = (): number => envInt("OCR_MAX_TOKENS", 16000, 256, 128000);
