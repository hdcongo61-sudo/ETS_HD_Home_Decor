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
  userStats: () => api.get('/sales/user-stats'),
  dashboard: () => api.get('/sales/dashboard-sale'),
  bestDays: () => api.get('/sales/best-days'),
  profitAnalytics: () => api.get('/sales/profit-analytics'),
  profitReport: () => api.get('/sales/profit-report'),

  // V2 — paiements, retours, reporting.
  returns: (saleId, data) => api.post(`/v2/sales/${saleId}/returns`, data),
  postReturn: (saleId, returnId, data) => api.post(`/v2/sales/${saleId}/returns/${returnId}/post`, data),
  cancelReturn: (saleId, returnId) => api.post(`/v2/sales/${saleId}/returns/${returnId}/cancel`),
  refunds: (data) => api.post('/v2/refunds', data),
  salesReport: (params) => api.get('/v2/reports/sales', { params }),
};

export default salesApi;
