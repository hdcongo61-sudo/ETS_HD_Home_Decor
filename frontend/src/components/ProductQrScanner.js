import React, { useEffect, useRef, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Live camera QR scanner. Calls `onDetect(decodedText)` for each scanned code
 * (debounced so the same code isn't fired repeatedly). The heavy html5-qrcode
 * library is only pulled in when this component mounts (lazy-loaded by callers).
 */
const ProductQrScanner = ({ onDetect, onError }) => {
  const reactId = useId();
  const elementId = `qr-reader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const onDetectRef = useRef(onDetect);
  const onErrorRef = useRef(onError);
  onDetectRef.current = onDetect;
  onErrorRef.current = onError;
  const lastRef = useRef({ value: '', at: 0 });

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    let started = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const now = Date.now();
          if (decodedText === lastRef.current.value && now - lastRef.current.at < 1500) return;
          lastRef.current = { value: decodedText, at: now };
          onDetectRef.current?.(decodedText);
        },
        () => {} // per-frame decode miss — ignore
      )
      .then(() => { started = true; })
      .catch((err) => { onErrorRef.current?.(err); });

    return () => {
      if (started) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      } else {
        try { scanner.clear(); } catch { /* not started yet */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once with the stable elementId
  }, [elementId]);

  return <div id={elementId} className="w-full overflow-hidden rounded-[var(--radiusLarge)] border border-[var(--ms-border)]" />;
};

export default ProductQrScanner;
