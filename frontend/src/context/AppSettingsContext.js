import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from '../utils/appBranding';

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
      const { data } = await api.get('/app-settings/public');
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
