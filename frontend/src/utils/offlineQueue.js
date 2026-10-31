// PoC — file d'attente de mutations hors-ligne (Phase 2 spike).
//
// Le principe : une mutation (création de vente, paiement, dépense…) est
// enregistrée localement AVANT d'être envoyée. Une fois le réseau revenu, la
// file est rejouée dans l'ordre. Chaque opération porte un `clientRequestId`
// unique ; le serveur le reconnaît et ne crée jamais de doublon (idempotence).
//
// Le stockage est injectable : IndexedDB par défaut, remplaçable en mémoire
// pour les tests.

const DB_NAME = 'hd-offline-queue';
const STORE = 'mutations';
const DB_VERSION = 1;

export const createClientRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const openDb = () =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'clientRequestId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

const idbStorage = {
  async all() {
    const db = await openDb();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () =>
          resolve((req.result || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },
  async put(op) {
    const db = await openDb();
    if (!db) return;
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).put(op);
    } catch {
      /* ignore */
    }
  },
  async remove(clientRequestId) {
    const db = await openDb();
    if (!db) return;
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).delete(clientRequestId);
    } catch {
      /* ignore */
    }
  },
};

export const enqueueMutation = async (op, storage = idbStorage) => {
  const record = {
    ...op,
    clientRequestId: op.clientRequestId || createClientRequestId(),
    createdAt: Date.now(),
    attempts: 0,
  };
  await storage.put(record);
  return record;
};

// Rejoue la file dans l'ordre FIFO.
//  - `send(op)` : exécute la requête, renvoie la réponse serveur.
//    Une réponse `{ deduplicated: true }` (ou `data.deduplicated === true`)
//    signifie que le serveur l'avait déjà — l'op est simplement retirée.
//  - `isOfflineError(err)` : détermine si l'erreur est un souci réseau
//    (dans ce cas on s'arrête pour réessayer plus tard).
export const drainMutations = async ({
  send,
  storage = idbStorage,
  isOfflineError = (err) => !err?.response,
  maxAttempts = 10,
} = {}) => {
  const queue = await storage.all();
  let sent = 0;
  let remaining = queue.length;

  for (const op of queue) {
    try {
      const response = await send(op);
      const deduplicated = Boolean(response?.deduplicated || response?.data?.deduplicated);
      await storage.remove(op.clientRequestId);
      remaining -= 1;
      if (!deduplicated) sent += 1;
    } catch (error) {
      if (isOfflineError(error)) {
        break; // réseau indisponible : on retentera à la prochaine occasion
      }
      const attempts = (Number(op.attempts) || 0) + 1;
      if (attempts >= maxAttempts) {
        await storage.remove(op.clientRequestId); // abandon après N échecs applicatifs
        remaining -= 1;
      } else {
        await storage.put({ ...op, attempts });
      }
      break; // ne pas envoyer la suite tant que celle-ci bloque
    }
  }

  return { sent, remaining };
};

export const pendingMutationCount = async (storage = idbStorage) => (await storage.all()).length;

export default { enqueueMutation, drainMutations, pendingMutationCount, createClientRequestId };
