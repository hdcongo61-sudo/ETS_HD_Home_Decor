import { useCallback, useEffect, useState } from 'react';

export default function usePwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  // Do NOT listen for 'beforeinstallprompt' or call event.preventDefault().
  // That triggers: "Banner not shown: beforeinstallpromptevent.preventDefault() called.
  // The page must call beforeinstallpromptevent.prompt() to show the banner."
  // Let the browser show its native install UI instead of our custom banner.

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    promptInstall
  };
}
