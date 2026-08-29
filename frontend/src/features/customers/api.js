/**
 * features/customers — client API du domaine clients (Phase 7.1).
 */
import api from '../../services/api';

export const customersApi = {
  list: (params, config) => api.get('/clients', { params, ...(config || {}) }),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  remove: (id) => api.delete(`/clients/${id}`),
  stats: () => api.get('/clients/stats'),
  filter: (params) => api.get('/clients/filter', { params }),
  addLoyalty: (clientId, data) => api.post(`/clients/${clientId}/loyalty`, data),
  loyaltyList: () => api.get('/clients/loyalty'),
};

export default customersApi;
