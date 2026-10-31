import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import useOfflineSync from '../hooks/useOfflineSync';

// Bandeau discret affiché quand des mutations locales attendent d'être
// rejouées vers le serveur (mode hors-ligne / réseau instable) ou sont
// bloquées sur un conflit (ex. stock insuffisant).
const SyncStatusIndicator = () => {
  const { pending, stale, flushing, retry } = useOfflineSync();

  if (pending === 0) return null;

  const hasStale = stale > 0;
  const border = hasStale ? 'border-rose-300' : 'border-amber-300';
  const bg = hasStale ? 'bg-rose-50/95' : 'bg-amber-50/95';
  const text = hasStale ? 'text-rose-800' : 'text-amber-800';
  const buttonBg = hasStale ? 'bg-rose-600' : 'bg-amber-600';

  return (
    <div
      className="fixed left-1/2 z-[45] w-full max-w-sm -translate-x-1/2 px-4"
      style={{ top: 'max(4.5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}
    >
      <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-lg backdrop-blur ${border} ${bg}`}>
        {hasStale ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
        )}
        <p className={`min-w-0 flex-1 text-sm font-medium ${text}`}>
          {hasStale
            ? `${stale} opération${stale > 1 ? 's' : ''} bloquée${stale > 1 ? 's' : ''} — vérifiez les données (ex. stock)`
            : `${pending} opération${pending > 1 ? 's' : ''} en attente de synchronisation`}
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={flushing}
          className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-white disabled:opacity-60 ${buttonBg}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${flushing ? 'animate-spin' : ''}`} />
          {flushing ? 'Sync…' : 'Réessayer'}
        </button>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
