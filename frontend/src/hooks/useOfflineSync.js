import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { flushOfflineQueue, pendingSyncCount } from '../utils/offlineSync';

// Compteur de mutations en attente de synchronisation + rejeu manuel.
export const useOfflineSync = () => {
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(() => {
    pendingSyncCount()
      .then(setPending)
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
      await flushOfflineQueue(api);
    } finally {
      await refresh();
      setFlushing(false);
    }
  }, [refresh]);

  return { pending, flushing, retry, refresh };
};

export default useOfflineSync;
