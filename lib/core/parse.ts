import type { Field, FieldSource } from "./types";

/**
 * Parsing for what the models send back. Each NDJSON field line is one field:
 * {"key": "...", "value": ..., "source": "..."}. `parseFieldLine` turns a line
 * into a typed field; the composed `applyField` (lib/diligence/form-schema.ts)
 * routes it to the product that owns the key.
 */

export interface ParsedField {
  key: string;
  value: unknown;
  source: FieldSource;
  /** The deck pages the model cited for this value (1-based), when it cited any. */
  slides?: number[];
}

const VALID_SOURCES = new Set<FieldSource>(["deck", "web", "inferred", "unknown"]);

/**
 * Confidence ranking of a field's source, highest first. "deck" and "web" are
 * peers — both are grounded in real material, and the pipeline deliberately
 * lets research (web) correct or enrich a deck claim (and vice versa on a
 * later pass), so neither should be blocked from overwriting the other.
 * "inferred" is the model's own ungrounded reasoning, so it must not silently
 * downgrade an already-filled "deck"/"web" field (see `applyTextField`).
 */
const SOURCE_PRIORITY: Record<FieldSource, number> = {
  deck: 2,
  web: 2,
  inferred: 1,
  unknown: 0,
};

/** Parse one NDJSON line into a field, tolerating fences/whitespace. */
export function parseFieldLine(line: string): ParsedField | null {
  const trimmed = line.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed) as { key?: unknown; value?: unknown; source?: unknown; slides?: unknown };
    if (typeof obj.key !== "string") return null;
    const source = (typeof obj.source === "string" && VALID_SOURCES.has(obj.source as FieldSource)
      ? obj.source
      : "inferred") as FieldSource;
    const slides = parseSlideNumbers(obj.slides);
    return slides ? { key: obj.key, value: obj.value, source, slides } : { key: obj.key, value: obj.value, source };
  } catch {
    return null;
  }
}

/** Most pages one field may cite; more than this is the model listing the whole deck. */
const MAX_CITED_SLIDES = 6;

/**
 * The `slides` a field line cites, as sorted, distinct page numbers. Accepts a
 * bare number too. Anything that isn't a whole page number is dropped; pages
 * past the end of the deck are clamped later, when the PDF's length is known.
 */
function parseSlideNumbers(raw: unknown): number[] | undefined {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const pages = new Set<number>();
  for (const item of list) {
    const n = typeof item === "string" ? Number(item.trim()) : item;
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 999) pages.add(n);
  }
  const sorted = [...pages].sort((a, b) => a - b).slice(0, MAX_CITED_SLIDES);
  return sorted.length ? sorted : undefined;
}

/**
 * Normalize em/en dashes (and stray double-hyphens) that the model likes to
 * emit down to a plain hyphen, while keeping numeric ranges tight (2020-2024).
 * A safety net so generated text never shows a dash even if the model ignores
 * the prompt instruction against them.
 */
export function cleanDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2") // numeric ranges → tight hyphen
    .replace(/\s*[–—]\s*/g, " - ") // em/en dash → spaced hyphen
    .replace(/\s*--\s*/g, " - ") // double hyphen → spaced hyphen
    .replace(/ {2,}/g, " "); // collapse doubled spaces
}

/** Pull the first {...} object out of the model's text, tolerating fences/prose. */
export function extractObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Any model value as clean display text. */
export function str(v: unknown): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return cleanDashes(s);
}

/** A 0–5 rating, rounded; anything that isn't a number reads as 0. */
export function clampRating(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

/**
 * Write a dotted "section.field" text cell (mutates). Returns true if the key
 * names a `Field` on the form and it was written; false for any other key, or
 * for a write skipped because it would downgrade an already-filled field to a
 * lower-confidence source (see `SOURCE_PRIORITY`).
 */
export function applyTextField(form: object, key: string, value: unknown, source: FieldSource): boolean {
  const [section, field] = key.split(".");
  const node = (form as Record<string, Record<string, unknown>>)[section];
  if (node && field && field in node) {
    const target = node[field];
    if (target && typeof target === "object" && "value" in target) {
      const current = target as { value?: unknown; source?: FieldSource };
      // Don't let a later stage silently downgrade an already-filled field to a
      // lower-confidence source (e.g. a real "deck" fact re-tagged "inferred"
      // because a weaker model just paraphrased it) — only upgrades/corrections
      // and same-tier re-emissions are allowed to overwrite.
      if (current.value && current.source && SOURCE_PRIORITY[source] < SOURCE_PRIORITY[current.source]) {
        return false;
      }
      node[field] = { value: str(value), source } satisfies Field;
      return true;
    }
  }
  return false;
}

/**
 * Split a streamed reply into lines as it arrives. `push` each delta, then
 * `flush` once the stream ends to deliver a trailing line with no newline.
 * Blank lines are dropped.
 */
export function createLineBuffer(onLine: (line: string) => void) {
  let buffer = "";
  return {
    push(delta: string) {
      buffer += delta;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) onLine(line);
      }
    },
    flush() {
      if (buffer.trim()) onLine(buffer);
    },
  };
}
