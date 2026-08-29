const express = require('express');
const router = express.Router();
const { protect, requireTenant, requirePermission } = require('../middlewares/authMiddleware');
const {
  getInvoices, getInvoice, createInvoice, postInvoice, cancelInvoice,
  registerInvoicePayment, getDiscrepancies, getPayableSummary,
} = require('../controllers/supplierInvoiceController');

// Factures fournisseur et dettes (Phase 6.6).
router.get('/supplier-invoices', protect, requireTenant, getInvoices);
router.get('/supplier-invoices/:id', protect, requireTenant, getInvoice);
router.get('/supplier-invoices/:id/discrepancies', protect, requireTenant, getDiscrepancies);
router.get('/supplier-payables', protect, requireTenant, getPayableSummary);
router.post('/supplier-invoices', protect, requireTenant, requirePermission('purchasing.manage'), createInvoice);
router.post('/supplier-invoices/:id/post', protect, requireTenant, requirePermission('purchasing.manage'), postInvoice);
router.post('/supplier-invoices/:id/cancel', protect, requireTenant, requirePermission('purchasing.manage'), cancelInvoice);
router.post('/supplier-invoices/:id/payments', protect, requireTenant, requirePermission('purchasing.manage'), registerInvoicePayment);

module.exports = router;
