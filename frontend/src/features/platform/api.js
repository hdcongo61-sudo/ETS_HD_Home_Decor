/**
 * features/platform — client API du domaine plateforme / utilisateurs (Phase 7.1).
 */
import api from '../../services/api';

export const platformApi = {
  users: (params) => api.get('/users', { params }),
  userStats: () => api.get('/users/stats'),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  weeklyReport: (data) => api.post('/notifications/admin-weekly-report', data),

  // Tenant & plan (self-service).
  myTenant: () => api.get('/tenants/me'),
  planCatalog: () => api.get('/tenants/plan-catalog'),
  requestPlan: (data) => api.post('/tenants/plan-request', data),
  updateAppSettings: (payload) => api.put('/app-settings', payload),
  exportBrochure: () => api.get('/export/brochure', { responseType: 'blob' }),
  employeesList: (params) => api.get('/employees', { params }),
  requestChange: (data) => api.post('/admin-requests', data),

  // Modules & paramètres v2 (7.3-7.4).
  modules: () => api.get('/v2/modules'),
  updateModule: (key, data) => api.put(`/v2/modules/${key}/settings`, data),
  settings: () => api.get('/v2/settings'),
  updateSettings: (values) => api.put('/v2/settings', { values }),

  // Assistance (tickets).
  supportCreate: (data) => api.post('/support', data),
  supportList: () => api.get('/support'),
  supportGet: (id) => api.get(`/support/${id}`),
  supportReply: (id, data) => api.post(`/support/${id}/reply`, data),

  // Divers tenant : boutiques, demandes de modification.
  locations: () => api.get('/locations'),
  registerTenant: (data) => api.post('/tenants/register', data),
  listRequests: () => api.get('/admin-requests'),
  reviewRequest: (id, data) => api.put(`/admin-requests/${id}/review`, data),

  // ── Super-admin : plan de contrôle plateforme ──
  docPdf: (type) => api.get(`/export/doc/${type}`, { responseType: 'blob' }),
  docContent: (t) => api.get(`/export/doc/${t}/content`),
  saveDocContent: (type, data) => api.put(`/export/doc/${type}/content`, data),
  resetDocContent: (type) => api.put(`/export/doc/${type}/content`, { reset: true }),
  adminSupportGet: (id) => api.get(`/support/admin/${id}`),
  adminSupportReply: (id, data) => api.post(`/support/admin/${id}/reply`, data),
  adminSupportUpdate: (id, data) => api.put(`/support/admin/${id}`, data),
  adminSupportAll: (params) => api.get('/support/admin/all', { params }),
  adminSupportUnread: () => api.get('/support/admin/unread'),
  tenants: () => api.get('/tenants'),
  respondPlanRequest: (id, action) => api.put(`/tenants/${id}/plan-request`, { action }),
  createTenant: (form) => api.post('/tenants', form),
  tenantPayment: (id, form) => api.post(`/tenants/${id}/payment`, form),
  updateTenant: (id, data) => api.put(`/tenants/${id}`, data),
  impersonateTenant: (id, payload) => api.post(`/tenants/${id}/impersonate`, payload),
  tenantsOverview: () => api.get('/tenants/stats/overview'),
  deleteTenant: (id) => api.delete(`/tenants/${id}`),
  tenantStats: (id) => api.get(`/tenants/${id}/stats`),
  tenantsAudit: (params) => api.get('/tenants/audit', { params }),
  plans: () => api.get('/tenants/plans'),
  savePlans: (plans) => api.put('/tenants/plans', { plans }),
  platformUsers: () => api.get('/platform-users'),
  deletePlatformUser: (id) => api.delete(`/platform-users/${id}`),
  createPlatformUser: (form) => api.post('/platform-users', form),
  updatePlatformUser: (id, form) => api.patch(`/platform-users/${id}`, form),
  sendPlatformEmail: (payload) => api.post('/platform-users/send-email', payload),
};

export default platformApi;
