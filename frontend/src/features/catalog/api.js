/**
 * features/catalog — client API du domaine catalogue & inventaire (Phase 7.1).
 */
import api from '../../services/api';

export const catalogApi = {
  // Catalogue legacy (v1) — migration progressive vers v2.
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data, config) => api.post('/products', data, config),
  update: (id, data) => api.put(`/products/${id}`, data),
  remove: (id) => api.delete(`/products/${id}`),
  duplicate: (id) => api.post(`/products/${id}/duplicate`),
  bulkUpdate: (data) => api.put('/products/bulk', data),
  dashboard: () => api.get('/products/dashboard'),
  neverSold: () => api.get('/products/never-sold'),
  slowMovers: () => api.get('/products/slow-movers'),
  lossMap: () => api.get('/products/loss-map'),
  stockMovements: () => api.get('/products/stock-movements'),

  // Inventaire v2 (registre).
  balances: (params) => api.get('/v2/inventory/balances', { params }),
  movements: (params) => api.get('/v2/inventory/movements', { params }),
  adjust: (data) => api.post('/v2/inventory/adjustments', data),
  inventoryReport: (params) => api.get('/v2/reports/inventory', { params }),
};

export default catalogApi;
