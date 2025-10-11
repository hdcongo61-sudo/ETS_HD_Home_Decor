import React, { useState } from 'react';
import usePwaPrompt from '../hooks/usePwaPrompt';

function PwaInstallPrompt() {
  const { isInstallable, promptInstall, isInstalled } = usePwaPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!isInstallable || dismissed || isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (!accepted) {
        setDismissed(true);
      }
    } catch (error) {
      console.error('Erreur pendant l’installation PWA :', error);
      setDismissed(true);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6">
      <div className="mx-4 flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">Installer ETS HD ?</p>
          <p className="text-xs text-slate-500">
            Ajoutez l’application sur votre écran d’accueil pour un accès mobile rapide.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2">
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {installing ? 'Installation…' : 'Installer'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

export default PwaInstallPrompt;
