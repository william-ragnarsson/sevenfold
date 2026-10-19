import { pdfFromStorage, pdfFromUrl, type PdfSource } from "@/lib/analyses/pdf-source";
import { getSampleDeck } from "@/lib/samples/airbnb";

/**
 * Where a saved analysis's PDF comes from: the bundled sample, else the copy in
 * Storage. Null when there's none, as for runs started from Claude.
 */
export function savedDeckSource(id: string, deckPath: string | null): PdfSource | null {
  const sample = getSampleDeck(id);
  if (sample) return pdfFromUrl(sample.pdfPath, id);
  return deckPath ? pdfFromStorage(deckPath, id) : null;
}

/** The page an analysis card shows as the deck's cover. */
export function coverPageOf(id: string): number {
  return getSampleDeck(id)?.coverPage ?? 1;
}
