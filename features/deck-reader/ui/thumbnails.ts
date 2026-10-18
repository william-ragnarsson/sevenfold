import type { PDFDocumentProxy } from "unpdf/pdfjs";
import type { PdfSource } from "@/lib/analyses/pdf-source";

/**
 * Renders a deck's pages to small images in the browser, so the Deck section
 * can show the real slides without the server storing or sending any images.
 *
 * pdf.js comes from `unpdf/pdfjs` (already a dependency; its worker is bundled
 * in) and is imported lazily, so it only downloads when a deck is shown. Pages
 * render one at a time, yielding between them, into object URLs.
 *
 * This is a small external store keyed by deck hash: `useDeckThumbnails` reads
 * it with `useSyncExternalStore`, and re-opening a report reuses the images
 * already made. The few most recent decks are kept; older ones are released.
 */

export type ThumbnailStatus = "idle" | "loading" | "ready" | "error";

export interface DeckThumbnails {
  status: ThumbnailStatus;
  /** Pages in the PDF, once it has been opened. */
  pageCount: number | null;
  /** Width over height of page 1, for sizing tiles before their images land. */
  aspect: number | null;
  /** Object URL per page (index 0 is page 1). A gap means not rendered, or it failed. */
  urls: readonly (string | undefined)[];
}

export const NO_THUMBNAILS: DeckThumbnails = { status: "idle", pageCount: null, aspect: null, urls: [] };

/**
 * Page image width in CSS pixels; scaled by the screen's pixel ratio, up to 2x.
 * The Deck section shows the slide in a 15rem (240px) column, so nothing is
 * drawn bigger than that.
 */
const THUMB_WIDTH = 240;
/** Decks kept in memory. Each holds an open PDF plus its page images. */
const MAX_DECKS = 3;

interface Entry {
  snapshot: DeckThumbnails;
  listeners: Set<() => void>;
  doc: Promise<PDFDocumentProxy>;
  objectUrls: string[];
  released: boolean;
  lastUsed: number;
}

const decks = new Map<string, Entry>();

function publish(entry: Entry, snapshot: DeckThumbnails) {
  entry.snapshot = snapshot;
  for (const listener of entry.listeners) listener();
}

/** Let the browser paint and handle input between pages. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => resolve(), { timeout: 200 });
    else setTimeout(resolve, 16);
  });
}

async function openDocument(source: PdfSource): Promise<PDFDocumentProxy> {
  const [bytes, { getDocument }] = await Promise.all([source.load(), import("unpdf/pdfjs")]);
  return getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true }).promise;
}

/** Draw one page at `cssWidth` and encode it. Returns the image and the page's aspect ratio. */
async function renderPage(doc: PDFDocumentProxy, pageNumber: number, cssWidth: number) {
  const page = await doc.getPage(pageNumber);
  const canvas = document.createElement("canvas");
  try {
    const base = page.getViewport({ scale: 1 });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (cssWidth * ratio) / base.width });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) throw new Error("No 2D canvas context");

    await page.render({ canvas, canvasContext, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))), "image/webp", 0.82),
    );
    return { blob, aspect: base.width / base.height };
  } finally {
    // Free the bitmap now rather than whenever GC gets to it; Safari caps total canvas memory.
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
}

async function renderAll(entry: Entry) {
  let doc: PDFDocumentProxy;
  try {
    doc = await entry.doc;
  } catch (err) {
    console.warn("[deck] couldn't open the PDF for thumbnails:", err);
    if (!entry.released) publish(entry, { ...entry.snapshot, status: "error" });
    return;
  }
  if (entry.released) return;

  publish(entry, { ...entry.snapshot, pageCount: doc.numPages, urls: Array.from({ length: doc.numPages }, () => undefined) });

  for (let n = 1; n <= doc.numPages; n++) {
    if (entry.released) return;
    try {
      const { blob, aspect } = await renderPage(doc, n, THUMB_WIDTH);
      if (entry.released) return;
      const url = URL.createObjectURL(blob);
      entry.objectUrls.push(url);
      const urls = entry.snapshot.urls.slice();
      urls[n - 1] = url;
      publish(entry, { ...entry.snapshot, aspect: entry.snapshot.aspect ?? aspect, urls });
    } catch (err) {
      // One bad page shouldn't cost the rest; its tile falls back to a number.
      if (entry.released) return;
      console.warn(`[deck] thumbnail for page ${n} failed:`, err);
    }
    await yieldToMain();
  }

  if (!entry.released) publish(entry, { ...entry.snapshot, status: "ready" });
}

function release(key: string, entry: Entry) {
  entry.released = true;
  decks.delete(key);
  for (const url of entry.objectUrls) URL.revokeObjectURL(url);
  entry.doc.then((doc) => doc.destroy()).catch(() => {});
}

/** Release the least recently used decks nobody is watching, down to `MAX_DECKS`. */
function trim() {
  if (decks.size <= MAX_DECKS) return;
  const unwatched = [...decks]
    .filter(([, entry]) => entry.listeners.size === 0)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key, entry] of unwatched) {
    if (decks.size <= MAX_DECKS) break;
    release(key, entry);
  }
}

function ensure(source: PdfSource): Entry {
  let entry = decks.get(source.key);
  if (!entry) {
    const doc = openDocument(source);
    doc.catch(() => {}); // reported by renderAll
    entry = {
      snapshot: { ...NO_THUMBNAILS, status: "loading" },
      listeners: new Set(),
      doc,
      objectUrls: [],
      released: false,
      lastUsed: Date.now(),
    };
    decks.set(source.key, entry);
    void renderAll(entry);
    trim();
  }
  entry.lastUsed = Date.now();
  return entry;
}

/** Start rendering `source` (if it isn't already) and call `listener` on every new page. */
export function subscribeThumbnails(source: PdfSource, listener: () => void): () => void {
  const entry = ensure(source);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    entry.lastUsed = Date.now();
    trim();
  };
}

export function getThumbnails(key: string): DeckThumbnails {
  return decks.get(key)?.snapshot ?? NO_THUMBNAILS;
}
