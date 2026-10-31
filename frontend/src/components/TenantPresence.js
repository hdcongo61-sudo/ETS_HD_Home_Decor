import { useEffect } from 'react';
import { platformApi } from '../features/platform/api';

const HEARTBEAT_INTERVAL_MS = 30000;

const TenantPresence = ({ tenantId }) => {
  useEffect(() => {
    if (!tenantId) return undefined;

    let active = true;
    const heartbeat = async () => {
      if (!active || document.visibilityState !== 'visible') return;
      try {
        await platformApi.recordTenantPresence();
      } catch (error) {
        console.error('Impossible de mettre à jour la présence de la boutique:', error);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [tenantId]);

  return null;
};

export default TenantPresence;
