/**
 * The deck, slide by slide: what was read off each page and which form fields
 * came from it. Kept apart from `DueDiligenceForm` on purpose. The form is the
 * public contract (markdown export, MCP, legacy import) and the final `report`
 * event replaces it wholesale, while this is a debugging and provenance layer
 * that rides alongside it in `AnalysisState.deck`.
 *
 * Nothing here touches the DOM, so the server (extraction, persistence) and the
 * client (the Deck section) share every type and helper in `features/deck-reader`.
 */

/** How the deck's text was obtained. */
export type DeckVia = "text-layer" | "vision-ocr" | "provided";

/** The text read off one page. */
export interface SlideText {
  /** 1-based PDF page number — the same number the `[Slide N]` marker carries. */
  index: number;
  text: string;
  /**
   * Set when the stored copy was cut short to keep the saved report small. The
   * model still saw the whole page; only this record of it is clipped.
   */
  truncated?: true;
}

/** What an extractor hands back: per-page text, plus anything it couldn't place. */
export interface DeckRead {
  /** Pages that had text, in page order. Empty when nothing marked the pages. */
  slides: SlideText[];
  /**
   * Text that came before the first slide marker. For a transcription with no
   * markers at all this is the whole deck, so nothing is ever lost.
   */
  unassigned: string;
}

/** The persisted slice of `AnalysisState` that the Deck section renders. */
export interface DeckState {
  /** Shape version, so a later change can migrate saved reports. */
  v: 1;
  /** Pages in the PDF; null when the deck arrived as text (e.g. over MCP). */
  pageCount: number | null;
  via: DeckVia | null;
  /** True once extraction has finished and its result was accepted. */
  read: boolean;
  /** Highest page number the reader has got past (with or without text). */
  readThrough: number;
  /** Pages that had text, sorted by index. Pages without text are simply absent. */
  slides: SlideText[];
  /** See `DeckRead.unassigned`. */
  unassigned?: string;
  /** Field key → the pages the model cited for it, e.g. `{"problem.core": [3]}`. */
  evidence: Record<string, number[]>;
}

export type DeckEvent =
  /** Extraction started on a deck with this many pages (null when it arrived as text). */
  | { type: "deck"; pageCount: number | null }
  /**
   * One page was read. Sent as soon as the page is finished (live, during vision
   * OCR), and again if the final read differs. Empty `text` = nothing on it.
   */
  | { type: "slide"; index: number; text: string; truncated?: true }
  /** Extraction finished and its text was accepted; `unassigned` = text before any marker. */
  | { type: "deck-read"; via: DeckVia; unassigned?: string };
