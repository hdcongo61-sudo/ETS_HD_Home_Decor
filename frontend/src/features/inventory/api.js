/**
 * features/inventory — client API du domaine inventaire v2 (Phase 7.1).
 *
 * Surface complète : soldes, journal des mouvements, ajustements,
 * transferts inter-boutiques, inventaires physiques, rapprochement.
 */
import api from '../../services/api';

export const inventoryApi = {
  // Soldes & mouvements (lecture).
  balances: (params) => api.get('/v2/inventory/balances', { params }),
  movements: (params) => api.get('/v2/inventory/movements', { params }),
  reconciliation: () => api.get('/v2/inventory/reconciliation'),

  // Ajustements manuels signés.
  adjust: (data) => api.post('/v2/inventory/adjustments', data),

  // Transferts inter-boutiques (machine à états).
  transfers: (params) => api.get('/v2/inventory/transfers', { params }),
  createTransfer: (data) => api.post('/v2/inventory/transfers', data),
  shipTransfer: (id) => api.post(`/v2/inventory/transfers/${id}/ship`),
  receiveTransfer: (id) => api.post(`/v2/inventory/transfers/${id}/receive`),
  cancelTransfer: (id) => api.post(`/v2/inventory/transfers/${id}/cancel`),

  // Inventaires physiques.
  counts: (params) => api.get('/v2/inventory/counts', { params }),
  createCount: (data) => api.post('/v2/inventory/counts', data),
  postCount: (id, data) => api.post(`/v2/inventory/counts/${id}/post`, data),
  cancelCount: (id) => api.post(`/v2/inventory/counts/${id}/cancel`),
};

export default inventoryApi;
