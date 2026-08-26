const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const {
  getOrders, getOrder, createOrder,
  submitOrder, approveOrder, rejectOrder, cancelOrder, closeOrder, receiveOrder,
} = require('../controllers/purchaseController');

// Bons de commande (Phase 6.3) et réceptions (Phase 6.4).
router.get('/purchase-orders', protect, requireTenant, getOrders);
router.get('/purchase-orders/:id', protect, requireTenant, getOrder);
router.post('/purchase-orders', protect, requireTenant, resolveLocation, requirePermission('purchasing.manage'), createOrder);
router.post('/purchase-orders/:id/submit', protect, requireTenant, requirePermission('purchasing.manage'), submitOrder);
router.post('/purchase-orders/:id/approve', protect, requireTenant, requirePermission('purchasing.manage'), approveOrder);
router.post('/purchase-orders/:id/reject', protect, requireTenant, requirePermission('purchasing.manage'), rejectOrder);
router.post('/purchase-orders/:id/cancel', protect, requireTenant, requirePermission('purchasing.manage'), cancelOrder);
router.post('/purchase-orders/:id/close', protect, requireTenant, requirePermission('purchasing.manage'), closeOrder);
router.post('/purchase-orders/:id/receive', protect, requireTenant, requirePermission('purchasing.manage'), receiveOrder);

module.exports = router;
