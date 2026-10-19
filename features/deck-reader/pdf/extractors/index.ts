import type { DeckTextExtractor } from "./types";
import { embeddedTextExtractor } from "./embedded-text";
import { visionOcrExtractor } from "./vision-ocr";

export type { DeckTextExtractor } from "./types";

/**
 * The ordered extraction chain, cheapest first: free native text-layer first,
 * then provider-backed vision OCR (the provider is chosen inside the extractor
 * by OCR_PROVIDER). Add a strategy by writing a `DeckTextExtractor` and slotting
 * it in here — the orchestrator and downstream pipeline stay untouched.
 */
export function getDeckTextExtractors(): DeckTextExtractor[] {
  return [embeddedTextExtractor, visionOcrExtractor];
}
