import { SLIDE_MARKER_RULE } from "../../markers";

/** Shared transcription instruction used by the vision-OCR extractor (and MCP). */
export const OCR_INSTRUCTION = [
  "This PDF is a startup pitch deck whose text is not machine-extractable",
  "(it's image-only or scanned). Transcribe ALL of its text content, slide by",
  "slide, into plain text. Preserve the reading order and keep numbers, metrics,",
  "names, and labels exactly as shown. Include chart/table values and any text",
  "embedded in images. Do not summarize, interpret, or add commentary — output",
  "only the transcribed text and the slide markers.",
  SLIDE_MARKER_RULE,
].join(" ");

/** The OCR instruction for one PDF; knowing the page count keeps the numbering honest. */
export function ocrInstruction(pageCount: number | null): string {
  return pageCount ? `${OCR_INSTRUCTION} This PDF has ${pageCount} pages.` : OCR_INSTRUCTION;
}
