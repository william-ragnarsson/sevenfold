import { formatSlides, matchSlideMarker } from "./markers";
import type { DeckRead, SlideText } from "./types";

/**
 * Splits deck text into pages at its slide markers. Works on a stream of
 * deltas (vision OCR arriving token by token) or on a finished string, and
 * both run through the same line-by-line state machine.
 */

export interface SlideStreamParser {
  /** Feed the next chunk of text. Only complete lines are examined. */
  push(delta: string): void;
  /** Flush the trailing line and return the whole read. */
  end(): DeckRead;
}

export interface SlideStreamParserOptions {
  /** The PDF's page count, when known; markers beyond it are treated as text. */
  maxIndex?: number | null;
  /**
   * Called each time a page is finished, which is when the next marker (or the
   * end) arrives. Fires for pages without text too, so a reader can move past
   * them. A page the transcriber returned to fires again with the joined text.
   */
  onSlide?: (slide: SlideText) => void;
}

export function createSlideStreamParser({ maxIndex, onSlide }: SlideStreamParserOptions = {}): SlideStreamParser {
  const pages = new Map<number, string>();
  const unassigned: string[] = [];
  let lines: string[] = [];
  let current: number | null = null;
  let last = 0;
  let strict = false;
  let buffer = "";

  const close = () => {
    if (current === null) return;
    const text = lines.join("\n").trim();
    const earlier = pages.get(current);
    const joined = earlier && text ? `${earlier}\n${text}` : earlier || text;
    pages.set(current, joined);
    onSlide?.({ index: current, text: joined });
  };

  const line = (raw: string) => {
    const marker = matchSlideMarker(raw, { strict, after: last, maxIndex });
    if (marker && marker.index !== current) {
      close();
      if (marker.canonical) strict = true;
      current = marker.index;
      last = Math.max(last, marker.index);
      lines = marker.rest ? [marker.rest] : [];
      return;
    }
    if (marker) return; // a repeated marker for the page already open
    if (current === null) unassigned.push(raw);
    else lines.push(raw);
  };

  return {
    push(delta) {
      buffer += delta;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        line(buffer.slice(0, newline).replace(/\r$/, ""));
        buffer = buffer.slice(newline + 1);
      }
    },
    end() {
      if (buffer) line(buffer);
      buffer = "";
      close();
      current = null;
      const slides = [...pages]
        .filter(([, text]) => text)
        .sort(([a], [b]) => a - b)
        .map(([index, text]) => ({ index, text }));
      return { slides, unassigned: unassigned.join("\n").trim() };
    },
  };
}

/** Split a finished transcription at its markers. */
export function parseSlides(text: string, maxIndex?: number | null): DeckRead {
  const parser = createSlideStreamParser({ maxIndex });
  parser.push(text);
  return parser.end();
}

/**
 * Deck text that arrived already transcribed (the sample deck, MCP), split into
 * pages and re-joined with canonical markers so the model always sees one
 * marker style. Text without markers comes back untouched.
 */
export function deckFromText(text: string, pageCount?: number | null): DeckRead & { deckText: string } {
  const read = parseSlides(text, pageCount);
  return { ...read, deckText: read.slides.length ? formatSlides(read) : text.trim() };
}
