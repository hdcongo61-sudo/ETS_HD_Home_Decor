/**
 * features/reporting — client API reporting, exports, imports (Phase 7.1).
 */
import api from '../../services/api';

export const reportingApi = {
  // Reporting paginé côté serveur (7.6).
  salesReport: (params) => api.get('/v2/reports/sales', { params }),
  inventoryReport: (params) => api.get('/v2/reports/inventory', { params }),

  // Exports asynchrones (7.7).
  createExport: (type, filters) => api.post('/v2/exports', { type, filters }),
  listExports: (params) => api.get('/v2/exports', { params }),
  exportJob: (id) => api.get(`/v2/exports/${id}`),
  downloadUrl: (id, token) => `/v2/exports/${id}/download?token=${encodeURIComponent(token)}`,

  // Imports en étapes (7.8).
  uploadProducts: (payload) => api.post('/v2/imports/products', payload),
  listImports: (params) => api.get('/v2/imports', { params }),
  importJob: (id) => api.get(`/v2/imports/${id}`),
  confirmImport: (id) => api.post(`/v2/imports/${id}/confirm`),
  runImport: (id) => api.post(`/v2/imports/${id}/run`),

  // Cutover (Phase 8) : drapeaux + rapports archivés.
  flags: () => api.get('/v2/flags'),
  setFlag: (key, value) => api.put(`/v2/flags/${key}`, { value }),
  cutoverReport: () => api.post('/v2/cutover/report'),
  cutoverReports: () => api.get('/v2/cutover/reports'),
  cutoverReportById: (id) => api.get(`/v2/cutover/reports/${id}`),
};

export default reportingApi;
