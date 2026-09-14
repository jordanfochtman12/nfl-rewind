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
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, name);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
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
    } catch {
      /* last-ditch: drop the blob rather than crash the GM */
    }
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
