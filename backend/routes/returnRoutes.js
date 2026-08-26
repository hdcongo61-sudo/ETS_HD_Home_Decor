const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const { createReturn, postReturn, cancelReturn, createRefund } = require('../controllers/returnController');

// Retours de vente (Phase 5.5).
router.post('/sales/:id/returns', protect, requireTenant, resolveLocation, requirePermission('sales.return'), createReturn);
router.post('/sales/:id/returns/:returnId/post', protect, requireTenant, requirePermission('sales.return'), postReturn);
router.post('/sales/:id/returns/:returnId/cancel', protect, requireTenant, requirePermission('sales.return'), cancelReturn);

// Remboursements autonomes.
router.post('/refunds', protect, requireTenant, resolveLocation, requirePermission('sales.refund'), createRefund);

module.exports = router;
