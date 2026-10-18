import { getProvider } from "@/lib/llm";
import { deriveProvider, getOcrModel } from "@/lib/config";
import { createSlideStreamParser } from "../../parser";
import { ocrInstruction } from "./instruction";
import type { DeckTextExtractor } from "./types";

/**
 * Generic vision-OCR fallback for image-only / scanned decks. Provider-agnostic:
 * it hands the PDF to whichever provider the OCR_MODEL implies via the
 * LlmProvider boundary. Selected after the free embedded-text strategy.
 *
 * The model is asked to mark each page (`[Slide N]`), and the transcription is
 * split at those markers while it streams, so each slide is reported the moment
 * the model moves past it. A model that ignores the markers still works: its
 * whole transcription comes back as `unassigned`.
 */
export const visionOcrExtractor: DeckTextExtractor = {
  name: "vision-ocr",
  via: "vision-ocr",
  async extract(buffer, { pageCount, onUsage, onSlide, signal }) {
    const model = getOcrModel();
    const parser = createSlideStreamParser({ maxIndex: pageCount, onSlide });
    let streamed = false;
    const text = await getProvider(deriveProvider(model)).transcribePdf(buffer, model, ocrInstruction(pageCount), {
      onUsage,
      onText: (delta) => {
        streamed = true;
        parser.push(delta);
      },
      signal,
    });
    // A provider that doesn't stream still returns the whole transcription.
    if (!streamed) parser.push(text);
    return parser.end();
  },
};
