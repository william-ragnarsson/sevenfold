import type { DeckTextExtractor } from "./types";

/**
 * Fast path: pull the PDF's embedded text layer via unpdf, which ships a
 * serverless/Node-compatible pdf.js build (no DOM / DOMMatrix needed).
 *
 * Reads page by page, so every slide maps to its own PDF page for free. Returns
 * nothing for image-only / scanned decks that carry no text layer, letting the
 * orchestrator fall through to a heavier strategy. It never calls `onSlide`:
 * if the text turns out too thin and OCR takes over, no half-read slides were
 * shown in the meantime.
 */
export const embeddedTextExtractor: DeckTextExtractor = {
  name: "embedded-text",
  via: "text-layer",
  async extract(buffer) {
    // No LLM call — nothing to report on `onUsage`.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    return {
      slides: pages.map((page, i) => ({ index: i + 1, text: page.trim() })).filter((s) => s.text),
      unassigned: "",
    };
  },
};
