/**
 * inventoryController — API v2 inventaire (Phases 4.2b-4.4).
 *
 * Endpoints exposés :
 *   GET  /api/v2/inventory/balances        soldes par produit/boutique
 *   GET  /api/v2/inventory/movements       journal des mouvements
 *   POST /api/v2/inventory/adjustments     ajustement manuel signé
 *   POST /api/v2/inventory/transfers       créer un transfert (draft)
 *   POST /api/v2/inventory/transfers/:id/ship     expédier (transfer_out)
 *   POST /api/v2/inventory/transfers/:id/receive  recevoir (transfer_in, partiel possible)
 *   POST /api/v2/inventory/transfers/:id/cancel   annuler (draft/submitted)
 *   POST /api/v2/inventory/counts          ouvrir un inventaire physique
 *   POST /api/v2/inventory/counts/:id/post publier l'écart (ajustements)
 *   POST /api/v2/inventory/counts/:id/cancel      annuler
 *   GET  /api/v2/inventory/reconciliation  Product.stock vs Σ balances
 */
const asyncHandler = require('express-async-handler');
const InventoryBalance = require('../models/inventoryBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const Product = require('../models/productModel');
const StockTransfer = require('../models/stockTransferModel');
const StockCount = require('../models/stockCountModel');
const { tenantFilter } = require('../utils/tenantQuery');
const { issueStock, receiveStock } = require('../services/inventoryService');
const transferService = require('../services/transferService');
const stockCountService = require('../services/stockCountService');

const asyncRoute = (fn) => asyncHandler(fn);

// ─────────────────────────── Soldes ───────────────────────────
// @route   GET /api/v2/inventory/balances
const getBalances = asyncRoute(async (req, res) => {
  const { locationId, productId, available } = req.query;
  const filter = { tenantId: req.tenantId };
  if (locationId) filter.locationId = locationId;
  if (productId) filter.productId = productId;

  const balances = await InventoryBalance.find(filter)
    .populate('productId', 'name sku image')
    .populate('variantId', 'sku optionValues isDefault')
    .sort({ productId: 1 })
    .limit(500)
    .lean();

  res.json({
    balances,
    count: balances.length,
    generatedAt: new Date(),
  });
});

// ─────────────────────────── Journal ───────────────────────────
// @route   GET /api/v2/inventory/movements
const getMovements = asyncRoute(async (req, res) => {
  const { type, productId, referenceType, referenceId, from, to, limit } = req.query;
  const filter = { ...tenantFilter(req) };
  if (type) filter.type = type;
  if (productId) filter.product = productId;
  if (referenceType) filter.referenceType = referenceType;
  if (referenceId) filter.referenceId = referenceId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const movements = await StockMovement.find(filter)
    .populate('product', 'name sku')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 500))
    .lean();

  res.json({ movements, count: movements.length });
});

// ─────────────────────────── Ajustement manuel ───────────────────────────
// @route   POST /api/v2/inventory/adjustments
const createAdjustment = asyncRoute(async (req, res) => {
  const { productId, quantity, unitCost = 0, note = '' } = req.body;
  const signedQuantity = Number(quantity);
  if (!Number.isFinite(signedQuantity) || signedQuantity === 0) {
    return res.status(400).json({ message: 'La quantité d\'ajustement (signée, non nulle) est requise.' });
  }
  const locationId = req.locationId || req.body.locationId || null;
  const base = {
    tenantId: req.tenantId,
    locationId,
    productId,
    unitCost: Number(unitCost) || 0,
    referenceType: 'adjustment',
    note: String(note || '').slice(0, 300),
    userId: req.user ? req.user._id : null,
  };

  const result = signedQuantity > 0
    ? await receiveStock({ ...base, quantity: signedQuantity, type: 'adjustment_in' })
    : await issueStock({ ...base, quantity: -signedQuantity, type: 'adjustment_out' });

  if (result.insufficient) {
    return res.status(409).json({ message: 'Stock insuffisant pour cet ajustement négatif.' });
  }
  res.status(201).json({ balance: result.balance, movement: result.movement });
});

// ─────────────────────────── Transferts ───────────────────────────
// @route   POST /api/v2/inventory/transfers
const createTransfer = asyncRoute(async (req, res) => {
  const { sourceLocationId, destinationLocationId, lines, note } = req.body;
  const transfer = await transferService.createTransfer({
    tenantId: req.tenantId,
    sourceLocationId,
    destinationLocationId,
    lines,
    note,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(transfer);
});

// @route   POST /api/v2/inventory/transfers/:id/ship
const shipTransfer = asyncRoute(async (req, res) => {
  const transfer = await transferService.shipTransfer({
    tenantId: req.tenantId,
    transferId: req.params.id,
    userId: req.user ? req.user._id : null,
  });
  res.json(transfer);
});

// @route   POST /api/v2/inventory/transfers/:id/receive
const receiveTransfer = asyncRoute(async (req, res) => {
  const transfer = await transferService.receiveTransfer({
    tenantId: req.tenantId,
    transferId: req.params.id,
    userId: req.user ? req.user._id : null,
    receivedQuantities: req.body.receivedQuantities || null,
  });
  res.json(transfer);
});

// @route   POST /api/v2/inventory/transfers/:id/cancel
const cancelTransfer = asyncRoute(async (req, res) => {
  const transfer = await transferService.cancelTransfer({
    tenantId: req.tenantId,
    transferId: req.params.id,
    userId: req.user ? req.user._id : null,
  });
  res.json(transfer);
});

// ─────────────────────────── Inventaires physiques ───────────────────────────
// @route   POST /api/v2/inventory/counts
const createCount = asyncRoute(async (req, res) => {
  const { locationId, productIds, reason, note } = req.body;
  const count = await stockCountService.createCount({
    tenantId: req.tenantId,
    locationId: locationId || req.locationId,
    productIds,
    reason,
    note,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(count);
});

// @route   POST /api/v2/inventory/counts/:id/post
const postCount = asyncRoute(async (req, res) => {
  const count = await stockCountService.postCount({
    tenantId: req.tenantId,
    countId: req.params.id,
    countedQuantities: req.body.countedQuantities,
    approverId: req.user ? req.user._id : null,
  });
  res.json(count);
});

// @route   POST /api/v2/inventory/counts/:id/cancel
const cancelCount = asyncRoute(async (req, res) => {
  const count = await stockCountService.cancelCount({
    tenantId: req.tenantId,
    countId: req.params.id,
    userId: req.user ? req.user._id : null,
  });
  res.json(count);
});

// ─────────────────────────── Réconciliation ───────────────────────────
// @route   GET /api/v2/inventory/reconciliation
const getReconciliation = asyncRoute(async (req, res) => {
  const aggregated = await InventoryBalance.aggregate([
    { $match: { tenantId: req.tenantId } },
    { $group: { _id: '$productId', total: { $sum: '$onHand' } } },
  ]);
  const totals = new Map(aggregated.map((row) => [String(row._id), row.total]));

  const products = await Product.find({ ...tenantFilter(req) }).select('name sku stock').lean();
  const mismatches = products
    .filter((product) => (totals.get(String(product._id)) || 0) !== (Number(product.stock) || 0))
    .map((product) => ({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      legacyStock: Number(product.stock) || 0,
      registryTotal: totals.get(String(product._id)) || 0,
      difference: (totals.get(String(product._id)) || 0) - (Number(product.stock) || 0),
    }));

  res.json({
    coherent: mismatches.length === 0,
    productsChecked: products.length,
    mismatches,
    generatedAt: new Date(),
  });
});

// ─────────────────────── Listes (lecture UI) ───────────────────────

// @route   GET /api/v2/inventory/transfers
const listTransfers = asyncRoute(async (req, res) => {
  const items = await StockTransfer.find({ tenantId: req.tenantId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 500))
    .lean();
  res.json(items);
});

// @route   GET /api/v2/inventory/counts
const listCounts = asyncRoute(async (req, res) => {
  const items = await StockCount.find({ tenantId: req.tenantId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 500))
    .lean();
  res.json(items);
});

module.exports = {
  getBalances,
  getMovements,
  createAdjustment,
  createTransfer,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  createCount,
  postCount,
  cancelCount,
  getReconciliation,
  listTransfers,
  listCounts,
};
