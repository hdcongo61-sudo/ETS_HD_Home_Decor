import { useEffect, useRef } from 'react';
import api from '../services/api';

const isStandalonePwa = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const mediaQuery = '(display-mode: standalone)';
  try {
    if (window.matchMedia && window.matchMedia(mediaQuery).matches) {
      return true;
    }
  } catch (error) {
    // Ignore matchMedia errors (older browsers)
  }

  return window.navigator.standalone === true;
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const usePushNotifications = (shouldEnable) => {
  const hasRegisteredRef = useRef(false);
  const vapidKeyRef = useRef(null);

  useEffect(() => {
    if (!shouldEnable) {
      hasRegisteredRef.current = false;
    }
  }, [shouldEnable]);

  useEffect(() => {
    if (
      !shouldEnable ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return;
    }

    if (!isStandalonePwa()) {
      return;
    }

    if (Notification.permission === 'denied') {
      return;
    }

    let cancelled = false;

    const ensureSubscription = async () => {
      if (hasRegisteredRef.current) {
        return;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        if (!vapidKeyRef.current) {
          const { data } = await api.get('/notifications/public-key');
          vapidKeyRef.current = data.publicKey;
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidKeyRef.current);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      const payload = {
        subscription: subscription.toJSON ? subscription.toJSON() : subscription,
        metadata: {
          platform: window.navigator.platform || '',
          userAgent: window.navigator.userAgent || '',
          language: window.navigator.language || ''
        }
      };

      await api.post('/notifications/subscribe', payload);

      if (!cancelled) {
        hasRegisteredRef.current = true;
      }
    };

    ensureSubscription().catch((error) => {
      console.error('Failed to configure push notifications', error);
    });

    return () => {
      cancelled = true;
    };
  }, [shouldEnable]);
};

export default usePushNotifications;
