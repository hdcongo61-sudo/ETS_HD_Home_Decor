import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
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
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      try {
        sessionStorage.removeItem('accessRestrictionInfo');
      } catch (_) {}
      const isLoginRoute = typeof window !== 'undefined' && window.location.pathname === '/login';
      if (!isLoginRoute && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
