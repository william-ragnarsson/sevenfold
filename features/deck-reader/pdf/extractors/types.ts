/**
 * A single strategy for turning a PDF buffer into deck text, page by page.
 *
 * Extractors are the plug-and-play unit of the PDF layer: each one knows how to
 * get text out of *some* kind of deck (a machine-readable text layer, an
 * image-only scan, …). The orchestrator in `extract.ts` runs them in order until
 * one returns enough text, so adding support for a new kind of deck means
 * writing one more `DeckTextExtractor` and registering it — nothing else changes.
 */
import type { DeckRead, DeckVia, SlideText } from "../../types";
import type { TokenUsage } from "@/lib/llm/types";

export interface ExtractContext {
  /** Pages in the PDF, counted before extraction starts; null if that failed. */
  pageCount: number | null;
  /** Only meaningful for LLM-backed strategies (e.g. vision OCR). */
  onUsage?: (usage: TokenUsage) => void;
  /**
   * A page finished while the strategy is still running. Only streaming
   * strategies call it; the orchestrator sends the final pages either way.
   */
  onSlide?: (slide: SlideText) => void;
  signal?: AbortSignal;
}

export interface DeckTextExtractor {
  /** Stable, human-readable name. Used only for logging which strategy ran. */
  readonly name: string;
  /** Recorded on the report, so it shows how the deck was read. */
  readonly via: DeckVia;

  /**
   * Attempt to read the PDF's pages.
   *
   * Return whatever text was found (the orchestrator decides if it's enough).
   * Return no slides and no unassigned text when this strategy simply can't
   * handle the PDF — the orchestrator will fall through to the next extractor.
   * Throwing is also tolerated: the orchestrator catches it, logs, and moves on,
   * so one broken strategy never breaks the chain.
   */
  extract(buffer: Buffer, ctx: ExtractContext): Promise<DeckRead>;
}
