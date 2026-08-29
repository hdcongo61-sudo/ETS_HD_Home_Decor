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
  dashboard: (params) => api.get('/products/dashboard', { params }),
  neverSold: () => api.get('/products/never-sold'),
  slowMovers: (params) => api.get('/products/slow-movers', { params }),
  bySupplier: (params) => api.get('/products/by-supplier', { params }),
  lossMap: () => api.get('/products/loss-map'),
  stockMovements: (params) => api.get('/products/stock-movements', { params }),
  fieldValues: () => api.get('/products/field-values'),
  images: (id) => api.get(`/products/${id}/images`),
  stats: (id, range) => api.get(`/products/${id}/stats`, { params: { range } }),
  salesHistory: (id, limit) => api.get(`/products/${id}/sales-history`, { params: { limit } }),
  addStockMovement: (data) => api.post('/products/stock-movement', data),
  removeStockMovement: (id) => api.delete(`/products/stock-movement/${id}`),

  // Référentiels (lookups) utilisés par le catalogue et les ventes.
  lookupCategories: () => api.get('/lookups/categories'),
  lookupContainers: () => api.get('/lookups/containers'),
  lookupWarehouses: () => api.get('/lookups/warehouses'),
  lookupSuppliers: () => api.get('/lookups/suppliers'),

  // Inventaire v2 (registre).
  balances: (params) => api.get('/v2/inventory/balances', { params }),
  movements: (params) => api.get('/v2/inventory/movements', { params }),
  adjust: (data) => api.post('/v2/inventory/adjustments', data),
  inventoryReport: (params) => api.get('/v2/reports/inventory', { params }),
};

export default catalogApi;
