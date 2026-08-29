/**
 * features/purchasing — client API achats, fournisseurs, réceptions
 * (Phase 7.1) — surface v2 complète.
 */
import api from '../../services/api';

export const purchasingApi = {
  // Fournisseurs (6.1).
  suppliers: (params) => api.get('/v2/suppliers', { params }),
  supplier: (id) => api.get(`/v2/suppliers/${id}`),
  createSupplier: (data) => api.post('/v2/suppliers', data),
  updateSupplier: (id, data) => api.put(`/v2/suppliers/${id}`, data),

  // Références d'achat (6.2).
  supplierProducts: (params) => api.get('/v2/supplier-products', { params }),
  createSupplierProduct: (data) => api.post('/v2/supplier-products', data),
  updateSupplierProduct: (id, data) => api.put(`/v2/supplier-products/${id}`, data),
  deleteSupplierProduct: (id) => api.delete(`/v2/supplier-products/${id}`),

  // Bons de commande (6.3) et réceptions (6.4).
  orders: (params) => api.get('/v2/purchase-orders', { params }),
  order: (id) => api.get(`/v2/purchase-orders/${id}`),
  createOrder: (data) => api.post('/v2/purchase-orders', data),
  submitOrder: (id) => api.post(`/v2/purchase-orders/${id}/submit`),
  approveOrder: (id) => api.post(`/v2/purchase-orders/${id}/approve`),
  rejectOrder: (id, reason) => api.post(`/v2/purchase-orders/${id}/reject`, { reason }),
  cancelOrder: (id) => api.post(`/v2/purchase-orders/${id}/cancel`),
  closeOrder: (id) => api.post(`/v2/purchase-orders/${id}/close`),
  receiveOrder: (id, receivedLines, idempotencyKey) =>
    api.post(`/v2/purchase-orders/${id}/receive`, { receivedLines, idempotencyKey }),

  // Expéditions entrantes (6.5).
  shipments: (params) => api.get('/v2/inbound-shipments', { params }),
  shipment: (id) => api.get(`/v2/inbound-shipments/${id}`),
  createShipment: (data) => api.post('/v2/inbound-shipments', data),
  updateShipment: (id, data) => api.put(`/v2/inbound-shipments/${id}`, data),
  markShipmentInTransit: (id) => api.post(`/v2/inbound-shipments/${id}/in-transit`),
  receiveShipment: (id) => api.post(`/v2/inbound-shipments/${id}/receive`),
  cancelShipment: (id) => api.post(`/v2/inbound-shipments/${id}/cancel`),
  landedCosts: (id, method) => api.get(`/v2/inbound-shipments/${id}/landed-costs`, { params: { method } }),

  // Factures fournisseur et dettes (6.6).
  invoices: (params) => api.get('/v2/supplier-invoices', { params }),
  invoice: (id) => api.get(`/v2/supplier-invoices/${id}`),
  createInvoice: (data) => api.post('/v2/supplier-invoices', data),
  postInvoice: (id) => api.post(`/v2/supplier-invoices/${id}/post`),
  cancelInvoice: (id) => api.post(`/v2/supplier-invoices/${id}/cancel`),
  payInvoice: (id, data) => api.post(`/v2/supplier-invoices/${id}/payments`, data),
  invoiceDiscrepancies: (id) => api.get(`/v2/supplier-invoices/${id}/discrepancies`),
  payables: (params) => api.get('/v2/supplier-payables', { params }),

  // Réapprovisionnement (6.7).
  replenishmentSuggestions: () => api.get('/v2/purchasing/replenishment-suggestions'),
};

export default purchasingApi;
