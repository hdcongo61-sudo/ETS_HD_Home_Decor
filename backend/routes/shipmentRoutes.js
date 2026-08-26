const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const {
  getShipments, getShipment, createShipment, updateShipment,
  markInTransit, receiveShipment, cancelShipment, getLandedCostAllocation,
} = require('../controllers/shipmentController');

// Expéditions entrantes (Phase 6.5).
router.get('/inbound-shipments', protect, requireTenant, getShipments);
router.get('/inbound-shipments/:id', protect, requireTenant, getShipment);
router.get('/inbound-shipments/:id/landed-costs', protect, requireTenant, getLandedCostAllocation);
router.post('/inbound-shipments', protect, requireTenant, resolveLocation, requirePermission('purchasing.manage'), createShipment);
router.put('/inbound-shipments/:id', protect, requireTenant, requirePermission('purchasing.manage'), updateShipment);
router.post('/inbound-shipments/:id/in-transit', protect, requireTenant, requirePermission('purchasing.manage'), markInTransit);
router.post('/inbound-shipments/:id/receive', protect, requireTenant, requirePermission('purchasing.manage'), receiveShipment);
router.post('/inbound-shipments/:id/cancel', protect, requireTenant, requirePermission('purchasing.manage'), cancelShipment);

module.exports = router;
