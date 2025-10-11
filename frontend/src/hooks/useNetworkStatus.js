import { useEffect, useState } from 'react';

const getInitialStatus = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine;
};

export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(getInitialStatus);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
