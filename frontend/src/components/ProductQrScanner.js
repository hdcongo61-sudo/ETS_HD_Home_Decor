import React, { useEffect, useRef, useId } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Live camera QR/barcode scanner. Calls `onDetect(decodedText)` for each scanned
 * code (debounced so the same code isn't fired repeatedly). The heavy
 * html5-qrcode library is only pulled in when this component mounts
 * (lazy-loaded by callers).
 *
 * `mode` controls the scan area and supported formats:
 *  - 'qr': square viewfinder, QR-focused (default).
 *  - 'barcode': wide viewfinder, 1D retail barcodes (EAN/UPC/Code128/Code39…).
 */
const ProductQrScanner = ({ onDetect, onError, mode = 'qr' }) => {
  const reactId = useId();
  const elementId = `qr-reader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const onDetectRef = useRef(onDetect);
  const onErrorRef = useRef(onError);
  const modeRef = useRef(mode);
  onDetectRef.current = onDetect;
  onErrorRef.current = onError;
  modeRef.current = mode;
  const lastRef = useRef({ value: '', at: 0 });

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    let started = false;

    const config = modeRef.current === 'barcode'
      ? {
          fps: 10,
          qrbox: { width: 320, height: 160 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        }
      : { fps: 10, qrbox: { width: 220, height: 220 } };

    scanner
      .start(
        { facingMode: 'environment' },
        config,
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
