import { formatCfa } from '../utils/format';
import React from 'react';
import { AlertTriangle, FileText, RefreshCw, WifiOff } from 'lucide-react';
import useOfflineSync from '../hooks/useOfflineSync';

// Bandeau discret affiché quand des mutations locales attendent d'être
// rejouées vers le serveur (mode hors-ligne / réseau instable) ou sont
// bloquées sur un conflit (ex. stock insuffisant).
const parseOperationData = (data) => {
  if (typeof data !== 'string') return data || {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

const describeOperation = (operation) => {
  const data = parseOperationData(operation.data);
  const path = String(operation.url || '').split('?')[0].replace(/\/+$/, '');
  const resource = path.split('/').filter(Boolean).pop() || 'opération';
  const method = String(operation.method || 'post').toLowerCase();
  const verb = {
    post: 'Création',
    put: 'Modification',
    patch: 'Modification',
    delete: 'Suppression',
  }[method] || 'Opération';

  if (resource === 'expenses' && method === 'post') {
    const details = [
      data.description,
      data.category,
      Number.isFinite(Number(data.amount)) && data.amount !== '' ? `${formatCfa(Number(data.amount))}` : null,
    ].filter(Boolean);
    return { title: 'Nouvelle dépense', details };
  }

  const labels = {
    sales: 'vente',
    expenses: 'dépense',
    clients: 'client',
    products: 'produit',
    employees: 'employé',
  };
  const name = labels[resource] || resource;
  return { title: `${verb} : ${name}`, details: [] };
};

const SyncStatusIndicator = () => {
  const { pending, stale, operations, flushing, retry } = useOfflineSync();

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
      <div className={`rounded-xl border p-3 shadow-lg backdrop-blur ${border} ${bg}`} aria-live="polite">
        <div className="flex items-center gap-3">
          {hasStale ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          ) : (
            <WifiOff className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          )}
          <p className={`min-w-0 flex-1 text-sm font-medium ${text}`}>
            {hasStale
              ? `${stale} opération${stale > 1 ? 's' : ''} bloquée${stale > 1 ? 's' : ''} — vérifiez les données`
              : `${pending} opération${pending > 1 ? 's' : ''} en attente de synchronisation`}
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={flushing}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60 ${buttonBg}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${flushing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {flushing ? 'Sync…' : 'Réessayer'}
          </button>
        </div>
        <ul className="mt-3 space-y-2 border-t border-current/15 pt-3" aria-label="Opérations en attente">
          {operations.map((operation) => {
            const description = describeOperation(operation);
            return (
              <li key={operation.clientRequestId} className={`flex min-w-0 items-start gap-2 text-xs ${text}`}>
                <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold">{description.title}</p>
                  {description.details.length > 0 && (
                    <p className="break-words opacity-90">{description.details.join(' · ')}</p>
                  )}
                  {operation.stale && <p className="mt-0.5 font-medium">À vérifier avant synchronisation</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
