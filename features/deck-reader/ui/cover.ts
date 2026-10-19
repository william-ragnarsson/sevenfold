import type { PdfSource } from "@/lib/analyses/pdf-source";
import { openDocument, renderPage } from "./thumbnails";

/**
 * One page of a deck (the first, unless the caller says otherwise) as an image
 * for the analysis cards. It's drawn in the browser with the same pdf.js setup
 * as the Deck section's thumbnails, then kept in IndexedDB, so each deck's PDF
 * downloads at most once per browser and a list of covers already drawn never
 * loads pdf.js at all.
 *
 * Lookup goes memory, then IndexedDB, then a render. Renders take turns, two at
 * a time, because pdf.js runs on the main thread here.
 *
 * Every IndexedDB call swallows its errors. A blocked store (private mode,
 * storage off) only means drawing the covers again.
 */

const DB_NAME = "sevenfold-covers";
const STORE = "covers";
/** Cover width in CSS pixels; scaled by the screen's pixel ratio, up to 2x. Cards are at most ~360px wide. */
const COVER_WIDTH = 360;
/** Covers kept in IndexedDB. The oldest go first. */
const MAX_SAVED = 200;
/** Renders running at once. */
const MAX_RENDERS = 2;

interface SavedCover {
  blob: Blob;
  savedAt: number;
}

/** Object URL per cover key, or null when it couldn't be drawn. Failures aren't retried until a reload. */
const covers = new Map<string, Promise<string | null>>();

let db: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (!db) {
    db = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE).createIndex("savedAt", "savedAt");
      req.onsuccess = () => {
        const opened = req.result;
        opened.onversionchange = () => {
          opened.close();
          db = null;
        };
        resolve(opened);
      };
      req.onerror = () => reject(req.error);
    });
    db.catch(() => {
      db = null;
    });
  }
  return db;
}

/** Run `fn` in one transaction. Resolves with what its returned getter reads once the transaction commits. */
async function transact<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => () => T): Promise<T> {
  const opened = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = opened.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result());
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readSaved(key: string): Promise<Blob | null> {
  try {
    const saved = await transact("readonly", (store) => {
      const req = store.get(key);
      return () => req.result as SavedCover | undefined;
    });
    return saved?.blob ?? null;
  } catch {
    return null;
  }
}

/** Keep `blob` under `key`, then drop the oldest covers past `MAX_SAVED`. */
async function save(key: string, blob: Blob): Promise<void> {
  try {
    await transact("readwrite", (store) => {
      store.put({ blob, savedAt: Date.now() } satisfies SavedCover, key);
      const count = store.count();
      count.onsuccess = () => {
        let extra = count.result - MAX_SAVED;
        if (extra <= 0) return;
        const oldest = store.index("savedAt").openKeyCursor();
        oldest.onsuccess = () => {
          const cursor = oldest.result;
          if (!cursor || extra-- <= 0) return;
          store.delete(cursor.primaryKey);
          cursor.continue();
        };
      };
      return () => undefined;
    });
  } catch (err) {
    console.warn("[deck] couldn't keep the cover:", err);
  }
}

let rendering = 0;
const waiting: (() => void)[] = [];

async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (rendering < MAX_RENDERS) rendering++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else rendering--;
  }
}

async function render(source: PdfSource, page: number): Promise<Blob> {
  const doc = await openDocument(source);
  try {
    return (await renderPage(doc, Math.min(Math.max(page, 1), doc.numPages), COVER_WIDTH)).blob;
  } finally {
    void doc.destroy();
  }
}

async function find(key: string, source: PdfSource, page: number): Promise<string | null> {
  let blob = await readSaved(key);
  if (!blob) {
    try {
      blob = await inTurn(() => render(source, page));
    } catch (err) {
      console.warn("[deck] couldn't draw the cover:", err);
      return null;
    }
    void save(key, blob);
  }
  return URL.createObjectURL(blob);
}

const coverKey = (deckHash: string, page: number) => `${deckHash}:p${page}:w${COVER_WIDTH}`;

/** An object URL for page `page` of the deck, or null when it can't be drawn. */
export function loadCover(source: PdfSource, page = 1): Promise<string | null> {
  const key = coverKey(source.key, page);
  let cover = covers.get(key);
  if (!cover) {
    cover = find(key, source, page);
    covers.set(key, cover);
  }
  return cover;
}

function release(key: string) {
  covers.get(key)?.then((url) => url && URL.revokeObjectURL(url));
  covers.delete(key);
}

/** Drop a deck's covers, for when its analysis is deleted. */
export async function forgetCover(deckHash: string): Promise<void> {
  for (const key of [...covers.keys()]) if (key.startsWith(`${deckHash}:`)) release(key);
  try {
    await transact("readwrite", (store) => {
      store.delete(IDBKeyRange.bound(`${deckHash}:`, `${deckHash}:￿`));
      return () => undefined;
    });
  } catch {
    // Left for the cap to clear.
  }
}

/** Drop every cover, for when all analyses (or the account) are deleted. */
export async function clearCovers(): Promise<void> {
  for (const key of [...covers.keys()]) release(key);
  try {
    await transact("readwrite", (store) => {
      store.clear();
      return () => undefined;
    });
  } catch {
    // Nothing to do: a store we can't open holds nothing we can clear.
  }
}
