/**
 * returnController — retours et remboursements v2 (Phase 5.5).
 */
const asyncHandler = require('express-async-handler');
const returnService = require('../services/returnService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   POST /api/v2/sales/:id/returns
const createReturn = asyncRoute(async (req, res) => {
  const ret = await returnService.createReturn({
    tenantId: req.tenantId,
    locationId: req.locationId || req.body.locationId || null,
    saleId: req.params.id,
    lines: req.body.lines,
    note: req.body.note,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(ret);
});

// @route   POST /api/v2/sales/:id/returns/:returnId/post
const postReturn = asyncRoute(async (req, res) => {
  const { ret, refund } = await returnService.postReturn({
    tenantId: req.tenantId,
    returnId: req.params.returnId,
    userId: req.user ? req.user._id : null,
    refund: req.body.refund || null,
    paymentIds: req.body.paymentIds || [],
  });
  res.json({ ret, refund });
});

// @route   POST /api/v2/sales/:id/returns/:returnId/cancel
const cancelReturn = asyncRoute(async (req, res) => {
  const ret = await returnService.cancelReturn({
    tenantId: req.tenantId,
    returnId: req.params.returnId,
    userId: req.user ? req.user._id : null,
  });
  res.json(ret);
});

// @route   POST /api/v2/refunds
const createRefund = asyncRoute(async (req, res) => {
  const result = await returnService.createRefund({
    tenantId: req.tenantId,
    locationId: req.locationId || req.body.locationId || null,
    saleId: req.body.saleId,
    amount: req.body.amount,
    method: req.body.method || 'cash',
    currency: req.body.currency || 'XOF',
    reason: req.body.reason,
    paymentIds: req.body.paymentIds || [],
    userId: req.user ? req.user._id : null,
    idempotencyKey: req.body.idempotencyKey || null,
  });
  if (result.alreadyApplied) return res.json(result.refund);
  res.status(201).json(result.refund);
});

// @route   GET /api/v2/sales/:id/returns
const listReturnsBySale = asyncRoute(async (req, res) => {
  const returns = await returnService.listReturnsBySale({
    tenantId: req.tenantId,
    saleId: req.params.id,
  });
  res.json(returns);
});

// @route   GET /api/v2/refunds
const listRefunds = asyncRoute(async (req, res) => {
  const refunds = await returnService.listRefunds({
    tenantId: req.tenantId,
    saleId: req.query.saleId || null,
  });
  res.json(refunds);
});

module.exports = { createReturn, postReturn, cancelReturn, createRefund, listReturnsBySale, listRefunds };
