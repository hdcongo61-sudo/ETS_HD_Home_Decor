/**
 * shipmentController — expéditions entrantes (Phase 6.5).
 */
const asyncHandler = require('express-async-handler');
const InboundShipment = require('../models/inboundShipmentModel');
const shipmentService = require('../services/shipmentService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   GET /api/v2/inbound-shipments
const getShipments = asyncRoute(async (req, res) => {
  const { status } = req.query;
  const filter = { tenantId: req.tenantId };
  if (status) filter.status = status;
  const shipments = await InboundShipment.find(filter)
    .populate('supplierIds', 'name')
    .populate('destinationLocationId', 'name code')
    .populate('purchaseOrderIds', 'code')
    .sort({ createdAt: -1 })
    .lean();
  res.json(shipments);
});

// @route   GET /api/v2/inbound-shipments/:id
const getShipment = asyncRoute(async (req, res) => {
  const shipment = await InboundShipment.findOne({ tenantId: req.tenantId, _id: req.params.id })
    .populate('supplierIds', 'name')
    .populate('destinationLocationId', 'name code')
    .populate('purchaseOrderIds', 'code')
    .lean();
  if (!shipment) return res.status(404).json({ message: 'Expédition introuvable dans cette organisation.' });
  res.json(shipment);
});

// @route   POST /api/v2/inbound-shipments
const createShipment = asyncRoute(async (req, res) => {
  const shipment = await shipmentService.createShipment({
    tenantId: req.tenantId,
    destinationLocationId: req.body.destinationLocationId || req.locationId,
    ...req.body,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(shipment);
});

// @route   PUT /api/v2/inbound-shipments/:id
const updateShipment = asyncRoute(async (req, res) => {
  const shipment = await shipmentService.updateShipment({
    tenantId: req.tenantId, shipmentId: req.params.id, data: req.body,
    userId: req.user ? req.user._id : null,
  });
  res.json(shipment);
});

// @route   POST /api/v2/inbound-shipments/:id/in-transit
const markInTransit = asyncRoute(async (req, res) => {
  const shipment = await shipmentService.markInTransit({
    tenantId: req.tenantId, shipmentId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(shipment);
});

// @route   POST /api/v2/inbound-shipments/:id/receive
const receiveShipment = asyncRoute(async (req, res) => {
  const shipment = await shipmentService.receiveShipment({
    tenantId: req.tenantId, shipmentId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(shipment);
});

// @route   POST /api/v2/inbound-shipments/:id/cancel
const cancelShipment = asyncRoute(async (req, res) => {
  const shipment = await shipmentService.cancelShipment({
    tenantId: req.tenantId, shipmentId: req.params.id, userId: req.user ? req.user._id : null,
  });
  res.json(shipment);
});

// @route   GET /api/v2/inbound-shipments/:id/landed-costs
const getLandedCostAllocation = asyncRoute(async (req, res) => {
  const allocation = await shipmentService.getLandedCostAllocation({
    tenantId: req.tenantId,
    shipmentId: req.params.id,
    method: req.query.method || 'value',
  });
  res.json(allocation);
});

module.exports = {
  getShipments, getShipment, createShipment, updateShipment,
  markInTransit, receiveShipment, cancelShipment, getLandedCostAllocation,
};
