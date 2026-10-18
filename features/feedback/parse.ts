import { cleanDashes } from "@/lib/core/parse";
import type { DeckFeedbackItem, DeckFeedbackSeverity } from "./types";

const VALID_SEVERITIES = new Set<DeckFeedbackSeverity>(["critical", "warning", "strength"]);

/** Parse one NDJSON line into a deck feedback item, tolerating fences/whitespace. */
export function parseFeedbackLine(line: string): DeckFeedbackItem | null {
  const trimmed = line.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const severity = typeof obj.severity === "string" && VALID_SEVERITIES.has(obj.severity as DeckFeedbackSeverity)
      ? (obj.severity as DeckFeedbackSeverity)
      : null;
    if (!severity || typeof obj.title !== "string" || !obj.title) return null;
    return {
      severity,
      category: cleanDashes(typeof obj.category === "string" ? obj.category : "General"),
      title: cleanDashes(obj.title),
      detail: cleanDashes(typeof obj.detail === "string" ? obj.detail : ""),
    };
  } catch {
    return null;
  }
}
