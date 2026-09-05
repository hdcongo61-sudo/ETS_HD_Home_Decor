/**
 * features/sales — client API du domaine ventes, paiements, retours (Phase 7.1).
 */
import api from '../../services/api';

export const salesApi = {
  // Ventes legacy (v1).
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  remove: (id, reason) => api.delete(`/sales/${id}`, { data: { reason } }),
  deleted: () => api.get('/sales/deleted'),
  addPayment: (id, data) => api.post(`/sales/${id}/payments`, data),
  deletePayment: (saleId, paymentId) => api.delete(`/sales/${saleId}/payments/${paymentId}`),
  sendReminder: (id, data) => api.post(`/sales/${id}/send-reminder`, data),
  updateReminder: (id, data) => api.put(`/sales/${id}/reminder`, data),
  deleteReminder: (id) => api.delete(`/sales/${id}/reminder`),
  updateDelivery: (id, data) => api.put(`/sales/${id}/delivery`, data),
  byUser: (userId) => api.get(`/sales/user/${userId}`),
  byClient: (clientId) => api.get(`/sales/client/${clientId}`),
  dateRange: (params) => api.get('/sales/date-range', { params }),
  paymentsDateRange: (params) => api.get('/sales/payments/date-range', { params }),
  stats: () => api.get('/sales/stats'),
  statsByStatus: () => api.get('/sales/stats/status'),
  deliveryStats: () => api.get('/sales/stats/delivery'),
  userStats: (params) => api.get('/sales/user-stats', { params }),
  dashboard: (params) => api.get('/sales/dashboard-sale', { params }),
  bestDays: () => api.get('/sales/best-days'),
  profitAnalytics: (params) => api.get('/sales/profit-analytics', { params }),
  profitReport: () => api.get('/sales/profit-report'),

  // V2 — paiements, retours, reporting.
  returns: (saleId, data) => api.post(`/v2/sales/${saleId}/returns`, data),
  postReturn: (saleId, returnId, data) => api.post(`/v2/sales/${saleId}/returns/${returnId}/post`, data),
  cancelReturn: (saleId, returnId) => api.post(`/v2/sales/${saleId}/returns/${returnId}/cancel`),
  listReturns: (saleId) => api.get(`/v2/sales/${saleId}/returns`),
  allReturns: (params) => api.get('/v2/returns', { params }),
  refunds: (data) => api.post('/v2/refunds', data),
  listRefunds: (params) => api.get('/v2/refunds', { params }),
  salesReport: (params) => api.get('/v2/reports/sales', { params }),

  // Caisse v1.
  bankList: (params) => api.get('/bank', { params }),
  bankCreate: (data) => api.post('/bank', data),
};

export default salesApi;
