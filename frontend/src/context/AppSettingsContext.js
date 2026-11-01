import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { platformApi } from '../features/platform/api';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, applyBrandTheme } from '../utils/appBranding';
import { setActiveCurrency, DEFAULT_CURRENCY } from '../utils/format';
import i18n from '../i18n';

const AppSettingsContext = createContext({
  appSettings: DEFAULT_APP_SETTINGS,
  platformBranding: {
    appName: DEFAULT_APP_SETTINGS.branding.appName,
    logoUrl: '',
    supportEmail: '',
    supportPhone: '',
    whatsappUrl: '',
    websiteUrl: '',
    address: '',
    updatedAt: null,
  },
  isLoading: true,
  refreshAppSettings: async () => {},
  setAppSettings: () => {},
  refreshPlatformBranding: async () => {},
  setPlatformBranding: () => {},
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
  const [platformBranding, setPlatformBrandingState] = useState({
    appName: DEFAULT_APP_SETTINGS.branding.appName,
    logoUrl: '',
    supportEmail: '',
    supportPhone: '',
    whatsappUrl: '',
    websiteUrl: '',
    address: '',
    updatedAt: null,
  });
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

  const loadPlatformBranding = async () => {
    try {
      const { data } = await platformApi.platformBranding();
      setPlatformBrandingState({
        appName: typeof data?.appName === 'string' && data.appName.trim()
          ? data.appName.trim()
          : DEFAULT_APP_SETTINGS.branding.appName,
        logoUrl: typeof data?.logoUrl === 'string' ? data.logoUrl : '',
        supportEmail: typeof data?.supportEmail === 'string' ? data.supportEmail : '',
        supportPhone: typeof data?.supportPhone === 'string' ? data.supportPhone : '',
        whatsappUrl: typeof data?.whatsappUrl === 'string' ? data.whatsappUrl : '',
        websiteUrl: typeof data?.websiteUrl === 'string' ? data.websiteUrl : '',
        address: typeof data?.address === 'string' ? data.address : '',
        updatedAt: data?.updatedAt || null,
      });
    } catch (error) {
      console.error('Unable to load platform branding', error);
    }
  };

  useEffect(() => {
    loadPlatformBranding();
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = platformBranding.appName || DEFAULT_APP_SETTINGS.branding.appName;
    }
  }, [platformBranding.appName]);

  // Apply the tenant brand colour to the design tokens (accent everywhere).
  useEffect(() => {
    applyBrandTheme(appSettings.branding.primaryColor);
  }, [appSettings.branding.primaryColor]);

  // Apply the tenant currency to the shared money formatter, so every
  // `formatCfa`/`formatMoney` call site follows the shop's currency.
  useEffect(() => {
    setActiveCurrency(appSettings.currency || DEFAULT_CURRENCY);
  }, [appSettings.currency]);

  // Apply the tenant UI language to i18next.
  useEffect(() => {
    const lang = appSettings.language || 'fr';
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang).catch(() => {});
    }
  }, [appSettings.language]);

  const value = useMemo(
    () => ({
      appSettings,
      platformBranding,
      isLoading,
      refreshAppSettings: () => loadAppSettings(true),
      setAppSettings: (nextSettings) => setAppSettingsState(normalizeAppSettings(nextSettings)),
      refreshPlatformBranding: loadPlatformBranding,
      setPlatformBranding: (nextBranding) => setPlatformBrandingState({
        appName: typeof nextBranding?.appName === 'string' && nextBranding.appName.trim()
          ? nextBranding.appName.trim()
          : DEFAULT_APP_SETTINGS.branding.appName,
        logoUrl: typeof nextBranding?.logoUrl === 'string' ? nextBranding.logoUrl : '',
        supportEmail: typeof nextBranding?.supportEmail === 'string' ? nextBranding.supportEmail : '',
        supportPhone: typeof nextBranding?.supportPhone === 'string' ? nextBranding.supportPhone : '',
        whatsappUrl: typeof nextBranding?.whatsappUrl === 'string' ? nextBranding.whatsappUrl : '',
        websiteUrl: typeof nextBranding?.websiteUrl === 'string' ? nextBranding.websiteUrl : '',
        address: typeof nextBranding?.address === 'string' ? nextBranding.address : '',
        updatedAt: nextBranding?.updatedAt || null,
      }),
    }),
    [appSettings, platformBranding, isLoading]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => useContext(AppSettingsContext);

export default AppSettingsContext;
