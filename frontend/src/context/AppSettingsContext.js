import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, applyBrandTheme } from '../utils/appBranding';

const AppSettingsContext = createContext({
  appSettings: DEFAULT_APP_SETTINGS,
  isLoading: true,
  refreshAppSettings: async () => {},
  setAppSettings: () => {},
});

// Cache court (sessionStorage) : évite de re-frapper /app-settings/public à
// chaque hot reload ou double-montage (StrictMode) et prévient le 429.
const SETTINGS_CACHE_KEY = 'hd_app_settings_cache_v1';
const SETTINGS_CACHE_TTL = 60 * 1000;

const readSettingsCache = () => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.savedAt && Date.now() - parsed.savedAt < SETTINGS_CACHE_TTL) {
      return parsed.settings;
    }
    return null;
  } catch {
    return null;
  }
};

const writeSettingsCache = (settings) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ settings, savedAt: Date.now() }));
  } catch {
    // stockage indisponible : on ignore
  }
};

export const AppSettingsProvider = ({ children }) => {
  const [appSettings, setAppSettingsState] = useState(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadAppSettings = async (force = false) => {
    if (!force) {
      const cached = readSettingsCache();
      if (cached) {
        setAppSettingsState(normalizeAppSettings(cached));
        setIsLoading(false);
        return;
      }
    }
    try {
      // When logged in, load THIS shop's settings (tenant-scoped). Otherwise
      // fall back to the public branding for the login page.
      const hasToken = typeof localStorage !== 'undefined' && localStorage.getItem('token');
      const endpoint = hasToken ? '/app-settings' : '/app-settings/public';
      let data;
      try {
        ({ data } = await api.get(endpoint));
      } catch (err) {
        // If the authenticated call fails (e.g. token expired), fall back to public.
        if (hasToken) {
          ({ data } = await api.get('/app-settings/public'));
        } else {
          throw err;
        }
      }
      setAppSettingsState(normalizeAppSettings(data));
      writeSettingsCache(data);
    } catch (error) {
      console.error('Unable to load app settings', error);
      setAppSettingsState(DEFAULT_APP_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppSettings();
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = appSettings.branding.appName || DEFAULT_APP_SETTINGS.branding.appName;
    }
  }, [appSettings.branding.appName]);

  // Apply the tenant brand colour to the design tokens (accent everywhere).
  useEffect(() => {
    applyBrandTheme(appSettings.branding.primaryColor);
  }, [appSettings.branding.primaryColor]);

  const value = useMemo(
    () => ({
      appSettings,
      isLoading,
      refreshAppSettings: () => loadAppSettings(true),
      setAppSettings: (nextSettings) => setAppSettingsState(normalizeAppSettings(nextSettings)),
    }),
    [appSettings, isLoading]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => useContext(AppSettingsContext);

export default AppSettingsContext;
