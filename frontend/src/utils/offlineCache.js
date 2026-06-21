// Minimal, dependency-free IndexedDB key/value store used to cache API GET
// responses so the app can show last-loaded data while offline.
// All methods fail soft: if IndexedDB is unavailable they no-op / return null.

const DB_NAME = 'hd-offline';
const STORE = 'api-cache';
const DB_VERSION = 1;

let dbPromise = null;

const openDb = () => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
};

// Stable key independent of the (dev/prod) base URL — keyed on path + params.
export const buildCacheKey = (config = {}) => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${method}:${url}:${params}`;
};

export const writeCache = async (key, value) => {
  const db = await openDb();
  if (!db) return;
  try {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put({ value, ts: Date.now() }, key);
  } catch {
    /* ignore quota / transaction errors */
  }
};

export const readCache = (key) =>
  new Promise((resolve) => {
    openDb().then((db) => {
      if (!db) return resolve(null);
      try {
        const t = db.transaction(STORE, 'readonly');
        const req = t.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null); // { value, ts } | null
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });

export const clearCache = async () => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch {
    /* ignore */
  }
};
