import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { flushOfflineQueue, pendingSyncCount } from '../utils/offlineSync';
import { staleMutationCount } from '../utils/offlineQueue';

// Compteur de mutations en attente de synchronisation + rejeu manuel.
export const useOfflineSync = () => {
  const [pending, setPending] = useState(0);
  const [stale, setStale] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(() => {
    pendingSyncCount()
      .then(setPending)
      .catch(() => {});
    staleMutationCount()
      .then(setStale)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('online', refresh);
    window.addEventListener('app:offline-queue-changed', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('app:offline-queue-changed', refresh);
    };
  }, [refresh]);

  const retry = useCallback(async () => {
    setFlushing(true);
    try {
      // Le rejeu manuel tente aussi les opérations bloquées (stale).
      await flushOfflineQueue(api, undefined, { includeStale: true });
    } finally {
      await refresh();
      setFlushing(false);
    }
  }, [refresh]);

  return { pending, stale, flushing, retry, refresh };
};

export default useOfflineSync;
