/**
 * features/auth — client API du domaine authentification/sessions/MFA.
 *
 * Convention Phase 7.1 : chaque feature possède ses fonctions d'API
 * (backed par le client Axios central), ses hooks, ses composants et ses
 * schémas. La monolithe reste intacte tant que la migration est en cours.
 */
import api from '../../services/api';

export const authApi = {
  login: (payload) => api.post('/users/login', payload),
  me: () => api.get('/users/me'),

  // Sessions (Phase 0.8)
  listSessions: () => api.get('/users/sessions'),
  revokeSession: (sessionId) => api.post(`/users/sessions/${sessionId}/revoke`),
  logoutAll: () => api.post('/users/logout-all'),

  // MFA TOTP (Phase 0.8)
  mfaSetup: () => api.post('/users/mfa/setup'),
  mfaVerify: (code) => api.post('/users/mfa/verify', { code }),
  mfaDisable: (password) => api.post('/users/mfa/disable', { password }),
};

export default authApi;
