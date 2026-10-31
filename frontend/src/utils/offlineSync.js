// Glue entre la file de mutations hors-ligne (offlineQueue) et le client HTTP.
// La construction complète (Phase 2) branchera l'UI dessus ; la file et le
// rejeu sont déjà testés unitairement.

import {
  drainMutations,
  pendingMutationCount,
  enqueueMutation,
  createClientRequestId,
} from './offlineQueue';

// Rejoue une opération mise en file via le client passé en argument
// (injectable pour rester testable sans axios).
export const sendQueuedWith = (client) => (op) =>
  client.request({
    method: op.method,
    url: op.url,
    data: op.data,
  });

export const flushOfflineQueue = (client, storage) =>
  drainMutations({ send: sendQueuedWith(client), storage });

export const pendingSyncCount = () => pendingMutationCount();

// Enregistre le rejeu automatique au retour du réseau + un filet de sécurité
// périodique. Idempotent (ne s'enregistre qu'une fois).
let registered = false;
export const registerOfflineReplay = (client) => {
  if (registered || typeof window === 'undefined') return;
  registered = true;
  window.addEventListener('online', () => {
    flushOfflineQueue(client).catch(() => {});
  });
  window.setInterval(() => {
    pendingMutationCount()
      .then((count) => {
        if (count > 0) return flushOfflineQueue(client);
        return null;
      })
      .catch(() => {});
  }, 60000);
};

export { enqueueMutation, createClientRequestId };
