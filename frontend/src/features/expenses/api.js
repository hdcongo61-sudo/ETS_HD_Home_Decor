/**
 * features/expenses — client API du domaine dépenses (Phase 7.1).
 */
import api from '../../services/api';

export const expensesApi = {
  list: (params) => api.get('/expenses', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  remove: (id) => api.delete(`/expenses/${id}`),
  dateRange: (params) => api.get('/expenses/date-range', { params }),
  categories: () => api.get('/lookups/expense-categories'),
};

export default expensesApi;
