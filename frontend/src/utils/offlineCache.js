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
export const buildCacheKey = (config = {}, userId, tenantId) => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  const baseKey = `${method}:${url}:${params}`;
  if (userId && tenantId) {
    return `${userId}_${tenantId}_${baseKey}`;
  }
  return baseKey;
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

export const readCache = async (key) => {
  const db = await openDb();
  if (!db) return null;
  try {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).get(key);
    const result = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (result) {
      const TTL_MS = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      if (now - result.ts > TTL_MS) {
        // Expired, delete it
        const txDel = db.transaction(STORE, 'readwrite');
        txDel.objectStore(STORE).delete(key);
        return null;
      }
    }

    return result;
  } catch {
    return null;
  }
};

export const clearCache = async () => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch {
    /* ignore */
  }
};

export const clearUserCache = async (userId, tenantId) => {
  if (!userId || !tenantId) return;
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const prefix = `${userId}_${tenantId}_`;
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('Failed to clear user cache:', err);
  }
};
