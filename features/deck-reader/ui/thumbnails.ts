import type { PDFDocumentProxy } from "unpdf/pdfjs";
import type { PdfSource } from "@/lib/analyses/pdf-source";

/**
 * Renders a deck's pages to images in the browser, so the Deck section can show
 * the real slides without the server storing or sending any images. Every page
 * is drawn small, for the thumbnail rail, and the slide being looked at is also
 * drawn full size when asked for (`requestSlide`).
 *
 * pdf.js comes from `unpdf/pdfjs` (already a dependency; its worker is bundled
 * in) and is imported lazily, so it only downloads when a deck is shown. Pages
 * render one at a time, yielding between them, into object URLs. A full-size
 * request goes ahead of the small pages still to draw.
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
  /** Full-size object URLs by page number, for the pages asked for lately. */
  large: Readonly<Record<number, string>>;
}

export const NO_THUMBNAILS: DeckThumbnails = { status: "idle", pageCount: null, aspect: null, urls: [], large: {} };

/**
 * Image widths in CSS pixels; scaled by the screen's pixel ratio, up to 2x.
 * Thumbnails are drawn for the rail, about 10rem wide, and big enough to stand
 * in for the big slide while its own image draws. Full-size pages are for the
 * big slide, which is under 900px wide at the dashboard's widest.
 */
const THUMB_WIDTH = 240;
const SLIDE_WIDTH = 960;
/** Decks kept in memory. Each holds an open PDF plus its page images. */
const MAX_DECKS = 3;
/** Full-size pages kept per deck. Older ones are released; asking again redraws them. */
const MAX_LARGE = 8;

interface Entry {
  snapshot: DeckThumbnails;
  listeners: Set<() => void>;
  doc: Promise<PDFDocumentProxy>;
  /** Pages in the PDF, once it's open. */
  pages: number | null;
  /** The next small page to draw, 1-based. */
  nextThumb: number;
  /** The page last asked for at full size, until its turn comes. Newer asks replace it. */
  wanted: number | null;
  pumping: boolean;
  /** Thumbnail object URLs. */
  objectUrls: string[];
  /** Full-size object URLs by page, least recently asked for first. */
  largeUrls: Map<number, string>;
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

export async function openDocument(source: PdfSource): Promise<PDFDocumentProxy> {
  const [bytes, { getDocument }] = await Promise.all([source.load(), import("unpdf/pdfjs")]);
  return getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true }).promise;
}

/** Draw one page at `cssWidth` and encode it. Returns the image and the page's aspect ratio. */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, cssWidth: number) {
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

async function start(entry: Entry) {
  let doc: PDFDocumentProxy;
  try {
    doc = await entry.doc;
  } catch (err) {
    console.warn("[deck] couldn't open the PDF for thumbnails:", err);
    if (!entry.released) publish(entry, { ...entry.snapshot, status: "error" });
    return;
  }
  if (entry.released) return;

  entry.pages = doc.numPages;
  publish(entry, { ...entry.snapshot, pageCount: doc.numPages, urls: Array.from({ length: doc.numPages }, () => undefined) });
  await pump(entry, doc);
}

/** Draw one page full size and keep it, releasing the least recently asked for past `MAX_LARGE`. */
async function drawLarge(entry: Entry, doc: PDFDocumentProxy, n: number) {
  const { blob, aspect } = await renderPage(doc, n, SLIDE_WIDTH);
  if (entry.released) return;
  entry.largeUrls.set(n, URL.createObjectURL(blob));
  for (const [page, url] of entry.largeUrls) {
    if (entry.largeUrls.size <= MAX_LARGE) break;
    URL.revokeObjectURL(url);
    entry.largeUrls.delete(page);
  }
  publish(entry, { ...entry.snapshot, aspect: entry.snapshot.aspect ?? aspect, large: Object.fromEntries(entry.largeUrls) });
}

async function drawThumb(entry: Entry, doc: PDFDocumentProxy, n: number) {
  const { blob, aspect } = await renderPage(doc, n, THUMB_WIDTH);
  if (entry.released) return;
  const url = URL.createObjectURL(blob);
  entry.objectUrls.push(url);
  const urls = entry.snapshot.urls.slice();
  urls[n - 1] = url;
  publish(entry, { ...entry.snapshot, aspect: entry.snapshot.aspect ?? aspect, urls });
}

/**
 * Draws pages one at a time until there's nothing left to draw: the page
 * wanted full size first, then the next thumbnail. Runs once per deck at a
 * time; `requestSlide` restarts it after the thumbnails are done.
 */
async function pump(entry: Entry, doc: PDFDocumentProxy) {
  if (entry.pumping) return;
  entry.pumping = true;
  try {
    while (!entry.released) {
      const large = entry.wanted;
      entry.wanted = null;
      if (large !== null) {
        if (entry.largeUrls.has(large)) continue;
        try {
          await drawLarge(entry, doc, large);
        } catch (err) {
          // The rail's thumbnail stays in its place.
          if (entry.released) return;
          console.warn(`[deck] full-size page ${large} failed:`, err);
        }
      } else if (entry.nextThumb <= doc.numPages) {
        const n = entry.nextThumb++;
        try {
          await drawThumb(entry, doc, n);
        } catch (err) {
          // One bad page shouldn't cost the rest; its tile falls back to a number.
          if (entry.released) return;
          console.warn(`[deck] thumbnail for page ${n} failed:`, err);
        }
        if (entry.nextThumb > doc.numPages && !entry.released) publish(entry, { ...entry.snapshot, status: "ready" });
      } else {
        return;
      }
      await yieldToMain();
    }
  } finally {
    entry.pumping = false;
  }
}

function release(key: string, entry: Entry) {
  entry.released = true;
  decks.delete(key);
  for (const url of entry.objectUrls) URL.revokeObjectURL(url);
  for (const url of entry.largeUrls.values()) URL.revokeObjectURL(url);
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
    doc.catch(() => {}); // reported by start
    entry = {
      snapshot: { ...NO_THUMBNAILS, status: "loading" },
      listeners: new Set(),
      doc,
      pages: null,
      nextThumb: 1,
      wanted: null,
      pumping: false,
      objectUrls: [],
      largeUrls: new Map(),
      released: false,
      lastUsed: Date.now(),
    };
    decks.set(source.key, entry);
    void start(entry);
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

/**
 * Draw page `n` full size (if it isn't already), ahead of any thumbnails still
 * to come. It lands in the snapshot's `large`. A newer ask replaces one that
 * hasn't started yet, so a stage moving quickly only ever waits on one page.
 */
export function requestSlide(source: PdfSource, n: number): void {
  const entry = ensure(source);
  const kept = entry.largeUrls.get(n);
  if (kept) {
    // Most recently asked for goes last, so it's released last.
    entry.largeUrls.delete(n);
    entry.largeUrls.set(n, kept);
    return;
  }
  if (entry.pages !== null && (n < 1 || n > entry.pages)) return;
  entry.wanted = n;
  // Before the PDF is open, `start` picks this up when it begins.
  if (entry.pages !== null) void entry.doc.then((doc) => pump(entry, doc));
}

export function getThumbnails(key: string): DeckThumbnails {
  return decks.get(key)?.snapshot ?? NO_THUMBNAILS;
}
