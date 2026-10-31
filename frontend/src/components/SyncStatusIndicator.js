import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import useOfflineSync from '../hooks/useOfflineSync';

// Bandeau discret affiché quand des mutations locales attendent d'être
// rejouées vers le serveur (mode hors-ligne / réseau instable).
const SyncStatusIndicator = () => {
  const { pending, flushing, retry } = useOfflineSync();

  if (pending === 0) return null;

  return (
    <div
      className="fixed left-1/2 z-[45] w-full max-w-sm -translate-x-1/2 px-4"
      style={{ top: 'max(4.5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}
    >
      <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50/95 p-3 shadow-lg backdrop-blur">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-sm font-medium text-amber-800">
          {pending} opération{pending > 1 ? 's' : ''} en attente de synchronisation
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={flushing}
          className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${flushing ? 'animate-spin' : ''}`} />
          {flushing ? 'Sync…' : 'Réessayer'}
        </button>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
