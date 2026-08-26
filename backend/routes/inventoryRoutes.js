const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const {
  getBalances, getMovements, createAdjustment,
  createTransfer, shipTransfer, receiveTransfer, cancelTransfer,
  createCount, postCount, cancelCount, getReconciliation,
} = require('../controllers/inventoryController');

// Lecture — toute personne authentifiée du tenant.
router.get('/balances', protect, requireTenant, getBalances);
router.get('/movements', protect, requireTenant, getMovements);
router.get('/reconciliation', protect, requireTenant, getReconciliation);

// Ajustements manuels.
router.post('/adjustments', protect, requireTenant, resolveLocation, requirePermission('inventory.adjust'), createAdjustment);

// Transferts inter-boutiques (machine à états).
router.post('/transfers', protect, requireTenant, requirePermission('inventory.transfer'), createTransfer);
router.post('/transfers/:id/ship', protect, requireTenant, requirePermission('inventory.transfer'), shipTransfer);
router.post('/transfers/:id/receive', protect, requireTenant, requirePermission('inventory.transfer'), receiveTransfer);
router.post('/transfers/:id/cancel', protect, requireTenant, requirePermission('inventory.transfer'), cancelTransfer);

// Inventaires physiques.
router.post('/counts', protect, requireTenant, requirePermission('inventory.count'), createCount);
router.post('/counts/:id/post', protect, requireTenant, requirePermission('inventory.count'), postCount);
router.post('/counts/:id/cancel', protect, requireTenant, requirePermission('inventory.count'), cancelCount);

module.exports = router;
