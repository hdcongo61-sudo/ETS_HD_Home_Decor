import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { flushOfflineQueue } from '../utils/offlineSync';
import { listPendingMutations } from '../utils/offlineQueue';

// Mutations en attente de synchronisation + rejeu manuel.
export const useOfflineSync = () => {
  const [operations, setOperations] = useState([]);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(() => {
    listPendingMutations()
      .then(setOperations)
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

  const pending = operations.length;
  const stale = operations.filter((operation) => operation.stale).length;

  return { pending, stale, operations, flushing, retry, refresh };
};

export default useOfflineSync;
