import React from 'react';
import useNetworkStatus from '../hooks/useNetworkStatus';

function OfflineIndicator() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-5 z-50 w-full max-w-sm -translate-x-1/2 px-4">
      <div className="rounded-xl border border-yellow-400 bg-white/95 p-3 shadow-2xl backdrop-blur">
        <p className="text-center text-sm font-medium text-yellow-600">
          Vous êtes hors-ligne. Les données mises en cache restent disponibles, certaines actions
          seront synchronisées à la reconnexion.
        </p>
      </div>
    </div>
  );
}

export default OfflineIndicator;
