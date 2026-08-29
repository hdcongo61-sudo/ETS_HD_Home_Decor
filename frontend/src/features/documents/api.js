/**
 * features/documents — client API du domaine documents (Phase 7.1).
 */
import api from '../../services/api';

export const documentsApi = {
  years: () => api.get('/documents/years'),
  list: (params) => api.get('/documents', { params }),
  upload: (formData, config) => api.post('/documents', formData, config),
  remove: (id) => api.delete(`/documents/${id}`),
};

export default documentsApi;
