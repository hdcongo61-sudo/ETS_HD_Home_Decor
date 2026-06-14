import React, { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * ServerWakeup
 * On app open, probes the backend /health endpoint. If the host is "cold"
 * (e.g. a Render free instance that spun down), the first response can take
 * 30–60s. While that probe is slow we show a small, non-blocking pill so the
 * blank screen doesn't look broken. When the server responds, the pill
 * disappears. If the server is already warm, nothing is ever shown.
 */
const SLOW_AFTER_MS = 2500;   // show the pill only if the probe is still pending after this
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 2500;

const ServerWakeup = () => {
  // 'checking' | 'slow' | 'ready' | 'error'
  const [state, setState] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      setState((s) => (s === 'checking' ? 'slow' : s));
    }, SLOW_AFTER_MS);

    const ping = async (attempt = 0) => {
      try {
        // baseURL already includes /api, so this hits /api/health.
        await api.get('/health', { timeout: 70000 });
        if (cancelled) return;
        clearTimeout(slowTimer);
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        if (attempt < MAX_ATTEMPTS - 1) {
          setTimeout(() => ping(attempt + 1), RETRY_DELAY_MS);
        } else {
          clearTimeout(slowTimer);
          setState('error');
        }
      }
    };
    ping();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  if (state !== 'slow') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-[300] flex max-w-[92vw] -translate-x-1/2 items-center gap-2.5 rounded-full border border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-2.5 shadow-[var(--ms-shadow-lg)]"
      style={{ top: 'calc(var(--app-nav-offset, 0px) + max(0.75rem, env(safe-area-inset-top, 0px)) + 0.5rem)' }}
    >
      <span
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--ms-border)]"
        style={{ borderTopColor: 'var(--ms-blue)' }}
        aria-hidden
      />
      <p className="truncate text-sm font-medium text-[var(--ms-text)]">
        Réveil du serveur… cela peut prendre jusqu'à une minute.
      </p>
    </div>
  );
};

export default ServerWakeup;
