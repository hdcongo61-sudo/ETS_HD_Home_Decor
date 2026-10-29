import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { confirmDialog } from './ConfirmProvider';
import { hasPendingWrites, subscribeToWrites } from '../utils/requestActivity';

const reloadPage = () => window.location.reload();

export default function MobileRefreshButton({ onRefresh = reloadPage }) {
  const location = useLocation();
  const saving = useSyncExternalStore(subscribeToWrites, hasPendingWrites, () => false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const dirty = useRef(false);
  const locked = useRef(false);
  const route = useRef(location.key);
  route.current = location.key;

  useEffect(() => {
    dirty.current = false;
    setMessage('');
    const markDirty = event => {
      const target = event.target;
      // Include inline count/table editors that are not wrapped in a form.
      if (target?.matches?.('input, select, textarea') || target?.isContentEditable) dirty.current = true;
    };
    document.addEventListener('input', markDirty, true);
    document.addEventListener('change', markDirty, true);
    return () => {
      document.removeEventListener('input', markDirty, true);
      document.removeEventListener('change', markDirty, true);
    };
  }, [location.key]);

  const refresh = async () => {
    if (locked.current || hasPendingWrites()) return;
    if (navigator.onLine === false) {
      setMessage('Connexion indisponible. Reconnectez-vous pour actualiser.');
      return;
    }
    locked.current = true;
    const currentRoute = route.current;
    try {
      if (dirty.current && !(await confirmDialog('Les modifications non enregistrées seront perdues. Actualiser cette page ?', {
        title: 'Actualiser la page ?', confirmLabel: 'Actualiser', cancelLabel: 'Continuer la saisie',
      }))) return;
      // A save or navigation may have started while confirmation was open.
      if (currentRoute !== route.current || hasPendingWrites()) return;
      if (navigator.onLine === false) {
        setMessage('Connexion indisponible. Reconnectez-vous pour actualiser.');
        return;
      }
      setMessage('');
      setRefreshing(true);
      await onRefresh();
    } catch {
      setMessage('Actualisation impossible. Réessayez.');
    } finally {
      locked.current = false;
      setRefreshing(false);
    }
  };

  return <div className="md:hidden relative shrink-0">
    <button type="button" onClick={refresh} disabled={saving || refreshing} aria-label={refreshing ? 'Actualisation en cours' : 'Actualiser la page'} aria-busy={refreshing}
      title={saving ? 'Enregistrement en cours — actualisation indisponible' : 'Actualiser'}
      className="ms-button ms-button-secondary min-h-[44px] min-w-[44px] px-2 disabled:opacity-50">
      <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
      <span className="sr-only">Actualiser</span>
    </button>
    {message && <p role="status" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 text-sm text-[var(--ms-text)] shadow-lg">{message}</p>}
  </div>;
}
