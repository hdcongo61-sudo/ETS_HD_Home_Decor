/**
 * supplierInvoiceController — factures fournisseur et dettes (Phase 6.6).
 */
const asyncHandler = require('express-async-handler');
const SupplierInvoice = require('../models/supplierInvoiceModel');
const invoiceService = require('../services/supplierInvoiceService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   GET /api/v2/supplier-invoices
const getInvoices = asyncRoute(async (req, res) => {
  const { status, supplierId } = req.query;
  const filter = { tenantId: req.tenantId };
  if (status) filter.status = status;
  if (supplierId) filter.supplierId = supplierId;
  const invoices = await SupplierInvoice.find(filter)
    .populate('supplierId', 'name code')
    .populate('purchaseOrderIds', 'code')
    .sort({ createdAt: -1 })
    .lean();
  res.json(invoices);
});

// @route   GET /api/v2/supplier-invoices/:id
const getInvoice = asyncRoute(async (req, res) => {
  const invoice = await SupplierInvoice.findOne({ tenantId: req.tenantId, _id: req.params.id })
    .populate('supplierId', 'name code')
    .populate('purchaseOrderIds', 'code')
    .lean();
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable dans cette organisation.' });
  res.json(invoice);
});

// @route   POST /api/v2/supplier-invoices
const createInvoice = asyncRoute(async (req, res) => {
  const invoice = await invoiceService.createInvoice({
    tenantId: req.tenantId,
    supplierId: req.body.supplierId,
    invoiceNumber: req.body.invoiceNumber,
    purchaseOrderIds: req.body.purchaseOrderIds,
    shipmentId: req.body.shipmentId || null,
    issueDate: req.body.issueDate || null,
    dueDate: req.body.dueDate || null,
    currency: req.body.currency || 'XOF',
    lines: req.body.lines || null,
    note: req.body.note,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(invoice);
});

// @route   POST /api/v2/supplier-invoices/:id/post
const postInvoice = asyncRoute(async (req, res) => {
  const invoice = await invoiceService.postInvoice({
    tenantId: req.tenantId, invoiceId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(invoice);
});

// @route   POST /api/v2/supplier-invoices/:id/cancel
const cancelInvoice = asyncRoute(async (req, res) => {
  const invoice = await invoiceService.cancelInvoice({
    tenantId: req.tenantId, invoiceId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(invoice);
});

// @route   POST /api/v2/supplier-invoices/:id/payments
const registerInvoicePayment = asyncRoute(async (req, res) => {
  const invoice = await invoiceService.registerInvoicePayment({
    tenantId: req.tenantId,
    invoiceId: req.params.id,
    amount: req.body.amount,
    method: req.body.method || 'cash',
    date: req.body.date || null,
    paidBy: req.user ? req.user._id : null,
  });
  res.json(invoice);
});

// @route   GET /api/v2/supplier-invoices/:id/discrepancies
const getDiscrepancies = asyncRoute(async (req, res) => {
  const result = await invoiceService.detectDiscrepancies({
    tenantId: req.tenantId, invoiceId: req.params.id,
  });
  res.json(result);
});

// @route   GET /api/v2/supplier-payables
const getPayableSummary = asyncRoute(async (req, res) => {
  const summary = await invoiceService.getPayableSummary({
    tenantId: req.tenantId,
    supplierId: req.query.supplierId || null,
  });
  res.json(summary);
});

module.exports = {
  getInvoices, getInvoice, createInvoice, postInvoice, cancelInvoice,
  registerInvoicePayment, getDiscrepancies, getPayableSummary,
};
