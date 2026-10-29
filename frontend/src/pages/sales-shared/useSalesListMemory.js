import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getSalesListReturn, salesMemoryScope, saveSalesList } from './salesListMemory';

export default function useSalesListMemory({ auth, location, navigationType, search, ready }) {
  const scope = salesMemoryScope(auth);
  const restored = useMemo(() => getSalesListReturn(scope, location, navigationType), [scope, location, navigationType]);
  const restoreDone = useRef(null);
  const anchor = useRef(null);
  const snapshot = useRef(null);
  snapshot.current = { search, path: location.pathname + location.search };
  const remember = useCallback(saleId => {
    if (!ready || (restored && restoreDone.current !== location.key)) return;
    if (saleId) anchor.current = saleId;
    saveSalesList(scope, location.key, { ...snapshot.current, scrollY: window.scrollY, saleId: anchor.current });
  }, [scope, location.key, ready, restored]);
  useEffect(() => {
    if (!ready || !restored || restoreDone.current === location.key) return;
    const frame = requestAnimationFrame(() => {
      const target = restored.saleId ? Array.from(document.querySelectorAll('[data-sale-id]')).find(node => node.dataset.saleId === restored.saleId) : null;
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
        target.querySelector('a')?.focus({ preventScroll: true });
      } else window.scrollTo({ top: restored.scrollY, behavior: 'instant' });
      anchor.current = restored.saleId || null;
      restoreDone.current = location.key;
      saveSalesList(scope, location.key, { ...snapshot.current, scrollY: window.scrollY, saleId: anchor.current });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, restored, location.key, scope]);
  useEffect(() => {
    if (!ready) return;
    if (!restored || restoreDone.current === location.key) remember();
    let pendingFrame = null;
    const save = () => remember();
    const onScroll = () => {
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => { pendingFrame = null; save(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', save);
    };
  }, [ready, restored, location.key, search, remember]);
  return { restored, remember };
}
