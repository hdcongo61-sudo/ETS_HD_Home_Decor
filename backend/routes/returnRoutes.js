const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const { createReturn, postReturn, cancelReturn, createRefund, listReturnsBySale, listAllReturns, listRefunds } = require('../controllers/returnController');

// Retours de vente (Phase 5.5).
router.get('/returns', protect, requireTenant, listAllReturns);
router.get('/sales/:id/returns', protect, requireTenant, listReturnsBySale);
router.post('/sales/:id/returns', protect, requireTenant, resolveLocation, requirePermission('sales.return'), createReturn);
router.post('/sales/:id/returns/:returnId/post', protect, requireTenant, requirePermission('sales.return'), postReturn);
router.post('/sales/:id/returns/:returnId/cancel', protect, requireTenant, requirePermission('sales.return'), cancelReturn);

// Remboursements autonomes.
router.get('/refunds', protect, requireTenant, listRefunds);
router.post('/refunds', protect, requireTenant, resolveLocation, requirePermission('sales.refund'), createRefund);

module.exports = router;
