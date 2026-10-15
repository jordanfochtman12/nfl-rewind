/** IndexedDB blob store for a 60-year dynasty. Falls back to localStorage. */
const DB_NAME = "nfl-rewind";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let askedToPersist = false;
/** Ask the browser to keep the game's storage: a "best effort" site can be wiped without warning when the device runs low. */
function keepStorage(): void {
  if (askedToPersist) return;
  askedToPersist = true;
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* not offered */
  }
}

/** The old studio voices' downloaded model (no longer used): the first thing to go when a save needs the room. */
async function dropVoiceCache(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    let dropped = false;
    for (const k of await caches.keys()) if (/transformers|onnx|kokoro|huggingface/i.test(k)) dropped = (await caches.delete(k)) || dropped;
    return dropped;
  } catch {
    return false;
  }
}

async function idbPut(name: string, value: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, name);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Set when a save could not be written at all, so the game can say so instead of losing it quietly. */
export const saveHealth = { failed: false, listeners: new Set<() => void>() };
function markFailed(failed: boolean): void {
  if (saveHealth.failed === failed) return;
  saveHealth.failed = failed;
  for (const l of saveHealth.listeners) l();
}

/** Keys of everything stored (for finding saves the slot list has lost track of). */
export async function storedKeys(): Promise<string[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const keys = await idbReq(tx.objectStore(STORE).getAllKeys());
    db.close();
    return keys.map(String);
  } catch {
    return [];
  }
}

export const dynastyStorage = {
  async getItem(name: string): Promise<string | null> {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, "readonly");
      const val = await idbReq(tx.objectStore(STORE).get(name));
      db.close();
      if (typeof val === "string") return val;
    } catch {
      /* fall through */
    }
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    keepStorage();
    try {
      try {
        await idbPut(name, value);
      } catch (err) {
        // Out of room: the voice model goes, the dynasty stays. One retry.
        if (!(await dropVoiceCache())) throw err;
        await idbPut(name, value);
      }
      markFailed(false);
      try {
        localStorage.setItem(
          `${name}:meta`,
          JSON.stringify({ bytes: value.length, t: Date.now() }),
        );
      } catch {
        /* meta is optional */
      }
      return;
    } catch {
      /* quota or private mode */
    }
    try {
      localStorage.setItem(name, value);
      return;
    } catch {
      /* nowhere left to put it: say so (below) rather than crash the GM */
    }
    markFailed(true);
  },
  async removeItem(name: string): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(name);
      db.close();
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(name);
      localStorage.removeItem(`${name}:meta`);
    } catch {
      /* ignore */
    }
  },
};
