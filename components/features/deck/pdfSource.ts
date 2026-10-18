import { getDeckUrl } from "@/lib/analyses/store";

/**
 * Where the deck's PDF bytes come from, so the thumbnail renderer doesn't care
 * whether it's the file just dropped in, the bundled sample, or a saved deck
 * in Storage. Nothing is fetched until `load()` is called, and the renderer
 * calls it at most once per deck.
 */
export interface PdfSource {
  /** The deck hash. Thumbnails are cached under it. */
  key: string;
  load(): Promise<ArrayBuffer>;
}

/** The file the user just picked. Read locally, so it costs no network. */
export function pdfFromFile(file: File, key: string): PdfSource {
  return { key, load: () => file.arrayBuffer() };
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  return res.arrayBuffer();
}

/** A PDF served by the app itself, such as the sample deck under /public. */
export function pdfFromUrl(url: string, key: string): PdfSource {
  return { key, load: () => fetchBytes(url) };
}

/** A saved deck in the private `decks` bucket, read through a short-lived signed URL. */
export function pdfFromStorage(deckPath: string, key: string): PdfSource {
  return {
    key,
    load: async () => {
      const url = await getDeckUrl(deckPath);
      if (!url) throw new Error("No signed URL for the saved deck");
      return fetchBytes(url);
    },
  };
}
