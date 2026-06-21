import React from 'react';
import useNetworkStatus from '../hooks/useNetworkStatus';

function OfflineIndicator() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className="fixed left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
      style={{ top: 'max(1.25rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="rounded-xl border border-yellow-400 bg-white/95 p-3 shadow-2xl backdrop-blur">
        <p className="text-center text-sm font-medium text-yellow-600">
          Vous êtes hors-ligne. Les dernières données chargées restent consultables ;
          les modifications nécessitent une connexion.
        </p>
      </div>
    </div>
  );
}

export default OfflineIndicator;
