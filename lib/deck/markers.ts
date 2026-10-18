import type { DeckRead } from "./types";

/**
 * Slide markers: the one line that says "page N starts here" inside a deck's
 * text. `[Slide N]` is the canonical form. Brackets rather than a heading or a
 * rule, because the prompt already fences the deck in `---` lines and markdown
 * headings are things decks contain on their own.
 */

/** The prompt sentence that asks a transcriber for markers. Shared by OCR and MCP. */
export const SLIDE_MARKER_RULE =
  'Begin each page with a line containing only its marker, "[Slide N]", where N is the PDF page number starting at 1. Emit the marker even for a page with no text, so the numbering always matches the PDF.';

const MAX_MARKER_INDEX = 999;

export function formatSlideMarker(index: number): string {
  return `[Slide ${index}]`;
}

const CANONICAL = /^\[Slide (\d{1,4})\]$/;

/**
 * The looser shapes a transcriber writes when it hasn't seen the rule above:
 * "Slide 1", "## Slide 2: Problem", "**Slide 3**", "--- Page 4 ---",
 * "Slide 5 of 20". After the number there must be either nothing or a
 * separator, so prose like "Page 6 of the report" is not taken for a marker.
 */
const TOLERANT =
  /^[\s#>*_[(=-]*(?:slide|page)\s*#?\s*(\d{1,4})(?:\s*(?:of|\/)\s*\d{1,4})?\s*(?:[\])*_=:.|\-–—]+\s*(.*?)[\s*_#=-]*|)$/i;

export interface SlideMarker {
  index: number;
  /** True for `[Slide N]`; false for a loose "Slide N" heading. */
  canonical: boolean;
  /** A title that shared the marker's line ("Slide 2: Problem" → "Problem"). */
  rest: string;
}

export interface MatchOptions {
  /**
   * Accept only `[Slide N]`. The parser switches to this as soon as it sees one,
   * so a "Page 3" footer inside a properly marked deck stays text.
   */
  strict: boolean;
  /** The last page number seen; a loose marker must be higher than it. */
  after: number;
  /** The PDF's page count, when known. */
  maxIndex?: number | null;
}

/** Read one line as a slide marker, or null when it is ordinary text. */
export function matchSlideMarker(line: string, { strict, after, maxIndex }: MatchOptions): SlideMarker | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 160) return null;
  const limit = maxIndex ?? MAX_MARKER_INDEX;

  const canonical = CANONICAL.exec(trimmed);
  if (canonical) {
    const index = Number(canonical[1]);
    return index >= 1 && index <= limit ? { index, canonical: true, rest: "" } : null;
  }
  if (strict) return null;

  const loose = TOLERANT.exec(trimmed);
  if (!loose) return null;
  const index = Number(loose[1]);
  // Loose markers only count while they climb: a stray "Page 2" footer on
  // slide 7 would otherwise send the reader back to the start.
  if (index < 1 || index > limit || index <= after) return null;
  return { index, canonical: false, rest: (loose[2] ?? "").trim() };
}

/** The deck as one string again, with canonical markers. What the model reads. */
export function formatSlides({ slides, unassigned }: DeckRead): string {
  if (slides.length === 0) return unassigned.trim();
  const parts = unassigned.trim() ? [unassigned.trim()] : [];
  for (const slide of slides) parts.push(`${formatSlideMarker(slide.index)}\n${slide.text}`);
  return parts.join("\n\n");
}

/** Characters of real text, markers excluded. The "is this deck readable?" measure. */
export function deckCharCount({ slides, unassigned }: DeckRead): number {
  return slides.reduce((n, s) => n + s.text.length, unassigned.trim().length);
}
