import axios from 'axios';
import { buildCacheKey, writeCache, readCache, clearCache } from '../utils/offlineCache';

const DEV_API_CANDIDATES = ['http://localhost:5001/api', 'http://localhost:5002/api'];
const DEV_API_STORAGE_KEY = 'ets_hd_api_base_url';

const isBrowser = typeof window !== 'undefined';
const isLocalDev = process.env.NODE_ENV === 'development';
const explicitApiUrl = process.env.REACT_APP_API_URL;

const getStoredDevApiBaseUrl = () => {
  if (!isBrowser) return null;
  try {
    return sessionStorage.getItem(DEV_API_STORAGE_KEY);
  } catch (_) {
    return null;
  }
};

const storeDevApiBaseUrl = (value) => {
  if (!isBrowser) return;
  try {
    sessionStorage.setItem(DEV_API_STORAGE_KEY, value);
  } catch (_) {}
};

const getInitialBaseUrl = () => {
  if (explicitApiUrl) return explicitApiUrl;
  if (isLocalDev) {
    const storedBaseUrl = getStoredDevApiBaseUrl();
    if (storedBaseUrl) return storedBaseUrl;
    return DEV_API_CANDIDATES[0];
  }
  // Production: use relative URL (same origin as frontend)
  return '/api';
};

const isRetriableDevFallback = (error) => {
  if (!isLocalDev || explicitApiUrl) return false;
  if (!error?.config) return false;
  if (error.config.__devPortRetried) return false;
  return !error.response || error.isHtmlResponse;
};

const getAlternateDevBaseUrl = (currentBaseUrl) =>
  DEV_API_CANDIDATES.find((candidate) => candidate !== currentBaseUrl) || null;

const api = axios.create({
  baseURL: getInitialBaseUrl(),
  // Évite "Unexpected token '<'" quand le serveur renvoie du HTML (404, SPA fallback, API injoignable)
  transformResponse: [(data, headers) => {
    if (data == null || typeof data === 'object') return data;
    const str = String(data);
    const contentType = (headers && headers['content-type']) || '';
    if (data.trimStart().startsWith('<') || contentType.includes('text/html')) {
      const err = new Error('Le serveur a renvoyé du HTML au lieu de JSON. Vérifiez REACT_APP_API_URL et que l’API backend est démarrée.');
      err.isHtmlResponse = true;
      throw err;
    }
    try {
      return JSON.parse(str);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Unexpected token') && str.trimStart().startsWith('<')) {
        const err = new Error('Le serveur a renvoyé du HTML au lieu de JSON. Vérifiez REACT_APP_API_URL et que l\'API backend est démarrée.');
        err.isHtmlResponse = true;
        throw err;
      }
      throw e;
    }
  }],
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur réponse : sur 401 (token expiré ou invalide), supprimer le token et rediriger vers login
api.interceptors.response.use(
  (response) => {
    if (isLocalDev && !explicitApiUrl) {
      const responseBaseUrl = response?.config?.baseURL || api.defaults.baseURL;
      if (responseBaseUrl) {
        api.defaults.baseURL = responseBaseUrl;
        storeDevApiBaseUrl(responseBaseUrl);
      }
    }
    // Cache successful GETs so they can be served offline (read-only).
    const cfg = response?.config || {};
    if ((cfg.method || 'get').toLowerCase() === 'get' && response?.data != null && !cfg.__noOfflineCache) {
      writeCache(buildCacheKey(cfg), response.data);
    }
    return response;
  },
  async (error) => {
    if (isRetriableDevFallback(error)) {
      const currentBaseUrl = error.config.baseURL || api.defaults.baseURL;
      const alternateBaseUrl = getAlternateDevBaseUrl(currentBaseUrl);

      if (alternateBaseUrl) {
        error.config.__devPortRetried = true;
        error.config.baseURL = alternateBaseUrl;
        api.defaults.baseURL = alternateBaseUrl;
        storeDevApiBaseUrl(alternateBaseUrl);
        return api.request(error.config);
      }
    }

    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      try {
        sessionStorage.removeItem('accessRestrictionInfo');
      } catch (_) {}
      // Drop cached data so the next user on this device doesn't see stale data.
      clearCache();
      const isLoginRoute = typeof window !== 'undefined' && window.location.pathname === '/login';
      if (!isLoginRoute && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    // Offline read-through: a GET with no server response (network down) falls
    // back to the last cached data so lists/dashboards still render.
    const cfg = error.config || {};
    if (!error.response && (cfg.method || 'get').toLowerCase() === 'get' && !cfg.__noOfflineCache) {
      const cached = await readCache(buildCacheKey(cfg));
      if (cached && cached.value != null) {
        return {
          data: cached.value,
          status: 200,
          statusText: 'OK (cache hors ligne)',
          headers: {},
          config: cfg,
          request: error.request,
          fromOfflineCache: true,
          cachedAt: cached.ts,
        };
      }
    }

    return Promise.reject(error);
  }
);

export default api;
