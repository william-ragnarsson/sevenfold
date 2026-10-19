import { EmptyDeckError } from "@/lib/core/types";
import { deckCharCount, formatSlides } from "../markers";
import { deckFromText } from "../parser";
import type { DeckRead, DeckVia, SlideText } from "../types";
import { getDeckTextExtractors } from "./extractors";
import type { TokenUsage } from "@/lib/llm/types";

/** Minimum characters for a deck to count as "readable" rather than empty. */
export const MIN_DECK_CHARS = 80;

/**
 * Where reading the deck reports its progress. `run.ts` turns each call into a
 * `ProgressEvent` (`deck` → `slide`… → `deck-read`), which is what the Deck
 * section in the report animates from.
 */
export interface DeckSink {
  pageCount(pageCount: number | null): void;
  slide(slide: SlideText): void;
  read(via: DeckVia, unassigned: string): void;
}

/** The read deck: its pages, plus the single string the pipeline is given. */
export interface ExtractedDeck extends DeckRead {
  /** The pages joined with `[Slide N]` markers, so the model can cite them. */
  deckText: string;
  via: DeckVia;
  pageCount: number | null;
}

/** Pages in a PDF, or null when it can't be opened. */
export async function countPdfPages(buffer: Buffer): Promise<number | null> {
  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const pages = pdf.numPages;
    await pdf.destroy();
    return pages;
  } catch {
    return null;
  }
}

/**
 * Turn a pitch-deck PDF buffer into the `deckText` the pipeline expects.
 *
 * This is the single seam between the user's upload and the diligence pipeline.
 * It runs each registered extraction strategy in order (fast native text first,
 * then provider-backed vision OCR for image-only / scanned decks) and returns
 * the first result that has enough text. A strategy that throws is logged and
 * skipped, so one broken path never blocks the others. Only when every strategy
 * comes up empty do we throw EmptyDeckError for the UI to surface.
 *
 * Note the chain is currently two strategies long and vision OCR tries exactly one
 * model — whichever `OCR_MODEL` names. There is no second OCR attempt and no
 * cross-provider fallback, so a transient failure from that one model fails the
 * whole run. Adding a fallback candidate here would be cheap; it hasn't been done.
 *
 * The pipeline downstream is untouched — it still just receives a string.
 */
export async function extractDeck(
  buffer: Buffer,
  { onUsage, sink, signal }: { onUsage?: (usage: TokenUsage) => void; sink?: DeckSink; signal?: AbortSignal } = {},
): Promise<ExtractedDeck> {
  const pageCount = await countPdfPages(buffer);
  sink?.pageCount(pageCount);

  // Pages already reported live, so the accepted read only re-sends what changed.
  const shown = new Map<number, string>();
  const show = (slide: SlideText) => {
    shown.set(slide.index, slide.text);
    sink?.slide(slide);
  };

  let lastError: unknown;

  for (const extractor of getDeckTextExtractors()) {
    signal?.throwIfAborted();
    try {
      const read = await extractor.extract(buffer, { pageCount, onUsage, onSlide: show, signal });
      if (deckCharCount(read) >= MIN_DECK_CHARS) {
        for (const slide of read.slides) {
          if (shown.get(slide.index) !== slide.text) show(slide);
        }
        sink?.read(extractor.via, read.unassigned);
        return { ...read, deckText: formatSlides(read), via: extractor.via, pageCount };
      }
    } catch (err) {
      // Stopped on purpose: don't fall through and start paying for the next one.
      if (signal?.aborted) throw err;
      // A failing strategy shouldn't break the chain — log and try the next.
      // But remember it: a systemic failure (no API credits, rate limit, network)
      // must not masquerade as an "image-only deck" if nothing else produces text.
      console.warn(`[pdf] extractor "${extractor.name}" failed:`, err);
      lastError = err;
    }
  }

  // Every strategy either returned too little text or failed. If a strategy
  // actually errored, surface that real cause; only when all strategies cleanly
  // came up empty is the deck genuinely unreadable.
  if (lastError) {
    throw lastError;
  }
  throw new EmptyDeckError();
}

/**
 * The same reporting for a deck that arrived already transcribed (the sample
 * deck, MCP): split at its markers, sent through `sink` as if it had just been
 * read, and joined back into the pipeline's `deckText`.
 */
export function provideDeck(text: string, pageCount: number | null, sink?: DeckSink): ExtractedDeck {
  const read = deckFromText(text, pageCount);
  sink?.pageCount(pageCount);
  for (const slide of read.slides) sink?.slide(slide);
  sink?.read("provided", read.unassigned);
  return { ...read, via: "provided", pageCount };
}
