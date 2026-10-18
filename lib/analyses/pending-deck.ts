/**
 * A deck someone picked before they had an account, held in the browser while
 * they sign up, so it can run on its own the moment they land in the
 * dashboard (`components/app-shell/ResumeStashedDeck`).
 *
 * IndexedDB rather than sessionStorage because it can store the `File` itself,
 * and it survives the full-page round trip to Google and back. One entry, one
 * hour: a deck picked yesterday shouldn't suddenly start running today.
 *
 * Every call swallows its errors. Losing the stash (private mode, storage
 * blocked) only means uploading the deck again after signing in.
 */

const DB_NAME = "sevenfold";
const STORE = "pending-deck";
const KEY = "deck";
const MAX_AGE_MS = 60 * 60 * 1000;

export interface StashedDeck {
  /** An uploaded PDF. */
  file?: File;
  /** Or one of the built-in samples, by id (see `lib/samples`). */
  sampleId?: string;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function fresh(entry: StashedDeck | undefined): StashedDeck | null {
  if (!entry || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
  return entry.file || entry.sampleId ? entry : null;
}

/** Keep `deck` until the user is signed in. Replaces anything stashed before. */
export async function stashDeck(deck: { file: File } | { sampleId: string }): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put({ ...deck, savedAt: Date.now() }, KEY));
  } catch (err) {
    console.warn("[pending-deck] couldn't keep the deck:", err);
  }
}

/** The stashed deck, if there's a recent one, left in place. */
export async function peekStashedDeck(): Promise<StashedDeck | null> {
  try {
    return fresh(await withStore<StashedDeck | undefined>("readonly", (s) => s.get(KEY)));
  } catch {
    return null;
  }
}

/** The stashed deck, if there's a recent one, removed so it only runs once. */
export async function takeStashedDeck(): Promise<StashedDeck | null> {
  try {
    const entry = await withStore<StashedDeck | undefined>("readonly", (s) => s.get(KEY));
    await withStore("readwrite", (s) => s.delete(KEY));
    return fresh(entry);
  } catch {
    return null;
  }
}
