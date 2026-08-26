/**
 * purchaseController — bons de commande et réceptions (Phases 6.3-6.4).
 */
const asyncHandler = require('express-async-handler');
const PurchaseOrder = require('../models/purchaseOrderModel');
const purchaseService = require('../services/purchaseService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   GET /api/v2/purchase-orders
const getOrders = asyncRoute(async (req, res) => {
  const { status, supplierId } = req.query;
  const filter = { tenantId: req.tenantId };
  if (status) filter.status = status;
  if (supplierId) filter.supplierId = supplierId;
  const orders = await PurchaseOrder.find(filter)
    .populate('supplierId', 'name code')
    .populate('lines.product', 'name sku')
    .sort({ createdAt: -1 })
    .lean();
  res.json(orders);
});

// @route   GET /api/v2/purchase-orders/:id
const getOrder = asyncRoute(async (req, res) => {
  const order = await PurchaseOrder.findOne({ tenantId: req.tenantId, _id: req.params.id })
    .populate('supplierId', 'name code')
    .populate('lines.product', 'name sku')
    .lean();
  if (!order) return res.status(404).json({ message: 'Bon de commande introuvable dans cette organisation.' });
  res.json(order);
});

// @route   POST /api/v2/purchase-orders
const createOrder = asyncRoute(async (req, res) => {
  const order = await purchaseService.createOrder({
    tenantId: req.tenantId,
    locationId: req.body.locationId || req.locationId,
    supplierId: req.body.supplierId,
    lines: req.body.lines,
    note: req.body.note,
    expectedDate: req.body.expectedDate || null,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(order);
});

// @route   POST /api/v2/purchase-orders/:id/submit
const submitOrder = asyncRoute(async (req, res) => {
  const order = await purchaseService.submitOrder({
    tenantId: req.tenantId, orderId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(order);
});

// @route   POST /api/v2/purchase-orders/:id/approve
const approveOrder = asyncRoute(async (req, res) => {
  const order = await purchaseService.approveOrder({
    tenantId: req.tenantId, orderId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(order);
});

// @route   POST /api/v2/purchase-orders/:id/reject
const rejectOrder = asyncRoute(async (req, res) => {
  const order = await purchaseService.rejectOrder({
    tenantId: req.tenantId, orderId: req.params.id,
    userId: req.user ? req.user._id : null,
    reason: req.body.reason || '',
  });
  res.json(order);
});

// @route   POST /api/v2/purchase-orders/:id/cancel
const cancelOrder = asyncRoute(async (req, res) => {
  const order = await purchaseService.cancelOrder({
    tenantId: req.tenantId, orderId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(order);
});

// @route   POST /api/v2/purchase-orders/:id/close
const closeOrder = asyncRoute(async (req, res) => {
  const order = await purchaseService.closeOrder({
    tenantId: req.tenantId, orderId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(order);
});

// @route   POST /api/v2/purchase-orders/:id/receive
const receiveOrder = asyncRoute(async (req, res) => {
  const result = await purchaseService.receiveOrder({
    tenantId: req.tenantId,
    orderId: req.params.id,
    userId: req.user ? req.user._id : null,
    receivedLines: req.body.receivedLines,
    idempotencyKey: req.body.idempotencyKey || req.headers['idempotency-key'] || null,
  });
  if (result.alreadyApplied) return res.json({ alreadyApplied: true, order: result.order });
  res.json({ alreadyApplied: false, order: result });
});

module.exports = {
  getOrders, getOrder, createOrder,
  submitOrder, approveOrder, rejectOrder, cancelOrder, closeOrder, receiveOrder,
};
