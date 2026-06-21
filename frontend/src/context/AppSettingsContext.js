import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, applyBrandTheme } from '../utils/appBranding';

const AppSettingsContext = createContext({
  appSettings: DEFAULT_APP_SETTINGS,
  isLoading: true,
  refreshAppSettings: async () => {},
  setAppSettings: () => {},
});

export const AppSettingsProvider = ({ children }) => {
  const [appSettings, setAppSettingsState] = useState(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadAppSettings = async () => {
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
      refreshAppSettings: loadAppSettings,
      setAppSettings: (nextSettings) => setAppSettingsState(normalizeAppSettings(nextSettings)),
    }),
    [appSettings, isLoading]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => useContext(AppSettingsContext);

export default AppSettingsContext;
