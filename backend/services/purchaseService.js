/**
 * PurchaseService — bons de commande et réceptions (Phases 6.3-6.4).
 *
 * - Numérotation atomique par organisation/période (Phase 5.3) ;
 * - machine à états avec séparation demandeur/approbateur ;
 * - réception partielle idempotente : mouvements `purchase_receipt` avec
 *   clés déterministes `po:{id}:{ligne}:recv:{déjàReçu}` ;
 * - les écarts (rejetés) sont enregistrés explicitement sur les lignes.
 */
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/purchaseOrderModel');
const Supplier = require('../models/supplierModel');
const SupplierProduct = require('../models/supplierProductModel');
const Product = require('../models/productModel');
const Location = require('../models/locationModel');
const StockMovement = require('../models/stockMovementModel');
const { receiveStock } = require('./inventoryService');
const { nextNumber } = require('./cashService');

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

const CAN_RECEIVE = ['approved', 'partially_received'];
const TERMINAL = ['received', 'closed', 'rejected', 'cancelled'];

async function createOrder({ tenantId, locationId, supplierId, lines, note = '', expectedDate = null, userId = null }) {
  const location = await Location.findOne({ tenantId, _id: locationId }).select('_id').lean();
  if (!location) throw conflict('Boutique introuvable dans cette organisation.');
  const supplier = await Supplier.findOne({ tenantId, _id: supplierId }).select('_id').lean();
  if (!supplier) throw conflict('Fournisseur introuvable dans cette organisation.');
  if (!Array.isArray(lines) || lines.length === 0) throw conflict('Au moins une ligne est requise.');

  const productIds = [...new Set(lines.map((line) => String(line.product)).filter(Boolean))];
  const products = await Product.find({ tenantId, _id: { $in: productIds } }).select('name sku').lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  if (products.length !== productIds.length) throw conflict('Un produit de la commande est introuvable dans cette organisation.');

  const normalized = [];
  let totalAmount = 0;
  for (const line of lines) {
    const quantity = Number(line.orderedQuantity || line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest('Quantité commandée invalide.');
    const unitCost = Number(line.unitCost) || 0;
    const taxRate = Number(line.taxRate) || 0;
    const discount = Number(line.discount) || 0;
    const lineTotal = quantity * unitCost * (1 + taxRate / 100) * (1 - discount / 100);
    totalAmount += lineTotal;
    const product = productMap.get(String(line.product));
    normalized.push({
      product: line.product,
      variantId: line.variantId || null,
      description: String(line.description || product?.name || '').slice(0, 300),
      orderedQuantity: quantity,
      receivedQuantity: 0,
      rejectedQuantity: 0,
      unitCost,
      currency: String(line.currency || 'XOF').toUpperCase(),
      taxRate,
      discount,
      expectedDate: line.expectedDate || expectedDate || null,
    });
  }

  const sequence = await nextNumber({
    tenantId, locationId, docType: 'PO', fiscalPeriod: String(new Date().getFullYear()),
  });
  const code = `PO-${sequence.fiscalPeriod}-${String(sequence.seq).padStart(4, '0')}`;

  return PurchaseOrder.create({
    tenantId,
    locationId,
    supplierId,
    code,
    status: 'draft',
    lines: normalized,
    totalAmount: round2(totalAmount),
    currency: normalized[0] ? normalized[0].currency : 'XOF',
    note: String(note || '').slice(0, 500),
    expectedDate: expectedDate || null,
    requestedBy: userId,
  });
}

const loadOrder = async (tenantId, orderId) => {
  const order = await PurchaseOrder.findOne({ tenantId, _id: orderId });
  if (!order) throw notFound('Bon de commande introuvable dans cette organisation.');
  return order;
};

async function submitOrder({ tenantId, orderId, userId = null }) {
  const order = await loadOrder(tenantId, orderId);
  if (order.status !== 'draft') throw conflict(`Impossible de soumettre une commande « ${order.status} ».`);
  order.status = 'submitted';
  order.submittedBy = userId;
  order.submittedAt = new Date();
  await order.save();
  return order;
}

async function approveOrder({ tenantId, orderId, userId = null }) {
  const order = await loadOrder(tenantId, orderId);
  if (order.status !== 'submitted') throw conflict(`Impossible d'approuver une commande « ${order.status} ».`);
  // Séparation demandeur/approbateur : l'approbateur doit être un autre utilisateur.
  if (userId && order.requestedBy && String(userId) === String(order.requestedBy)) {
    throw conflict('La commande doit être approuvée par un utilisateur différent du demandeur.');
  }
  order.status = 'approved';
  order.approvedBy = userId;
  order.approvedAt = new Date();
  await order.save();
  return order;
}

async function rejectOrder({ tenantId, orderId, userId = null, reason = '' }) {
  const order = await loadOrder(tenantId, orderId);
  // Un brouillon s'annule ; seul un ordre soumis peut être rejeté.
  if (order.status !== 'submitted') {
    throw conflict(`Impossible de rejeter une commande « ${order.status} ».`);
  }
  order.status = 'rejected';
  order.rejectedBy = userId;
  order.rejectedAt = new Date();
  order.rejectionReason = String(reason || '').slice(0, 300);
  await order.save();
  return order;
}

async function cancelOrder({ tenantId, orderId, userId = null }) {
  const order = await loadOrder(tenantId, orderId);
  if (!['draft', 'submitted'].includes(order.status)) {
    throw conflict(`Impossible d'annuler une commande « ${order.status} ».`);
  }
  order.status = 'cancelled';
  order.cancelledBy = userId;
  order.cancelledAt = new Date();
  await order.save();
  return order;
}

async function closeOrder({ tenantId, orderId, userId = null }) {
  const order = await loadOrder(tenantId, orderId);
  if (order.status !== 'received') throw conflict(`Impossible de clôturer une commande « ${order.status} ».`);
  order.status = 'closed';
  order.closedBy = userId;
  order.closedAt = new Date();
  await order.save();
  return order;
}

/**
 * Réception (partielle) idempotente.
 * receivedLines : [{ productId, quantity, rejectedQuantity }]
 */
async function receiveOrder({ tenantId, orderId, userId = null, receivedLines = [], idempotencyKey = null }) {
  const order = await loadOrder(tenantId, orderId);
  if (!CAN_RECEIVE.includes(order.status)) {
    throw conflict(`Impossible de réceptionner une commande « ${order.status} ».`);
  }
  if (!Array.isArray(receivedLines) || receivedLines.length === 0) {
    throw conflict('Au moins une ligne de réception est requise.');
  }

  // Clé d'idempotence fournie par l'appelant (retry sûr du même appel).
  if (idempotencyKey) {
    const existing = await StockMovement.findOne({
      tenantId, idempotencyKey: `${idempotencyKey}:0`,
    }).lean();
    if (existing) return { alreadyApplied: true, order };
  }

  const requested = new Map();
  for (const line of receivedLines) {
    const productId = String(line.productId);
    const quantity = Number(line.quantity);
    const rejectedQuantity = Number(line.rejectedQuantity) || 0;
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest('Quantité reçue invalide.');
    if (!Number.isFinite(rejectedQuantity) || rejectedQuantity < 0) throw badRequest('Quantité rejetée invalide.');
    requested.set(productId, { quantity, rejectedQuantity });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const movements = [];
    for (let i = 0; i < order.lines.length; i += 1) {
      const line = order.lines[i];
      const key = String(line.product);
      const entry = requested.get(key);
      if (!entry) continue;

      const remaining = line.orderedQuantity - line.receivedQuantity - line.rejectedQuantity;
      if (entry.quantity + entry.rejectedQuantity > remaining) {
        await session.abortTransaction();
        throw conflict(`Quantité reçue supérieure au restant pour le produit ${line.product} (${remaining}).`);
      }

      const alreadyReceived = line.receivedQuantity;
      const movementKey = idempotencyKey
        ? `${idempotencyKey}:${i}`
        : `po:${order._id}:${i}:recv:${alreadyReceived}`;
      const result = await receiveStock({
        tenantId,
        locationId: order.locationId,
        productId: line.product,
        quantity: entry.quantity,
        unitCost: line.unitCost,
        type: 'purchase_receipt',
        referenceType: 'purchaseOrder',
        referenceId: order._id,
        idempotencyKey: movementKey,
        note: `Réception ${order.code}`,
        userId,
      }, session);
      const effective = result.alreadyApplied ? result.movement.quantity : entry.quantity;
      line.receivedQuantity = alreadyReceived + effective;
      line.rejectedQuantity = (line.rejectedQuantity || 0) + entry.rejectedQuantity;
      movements.push(result.movement._id);

      // Meilleure connaissance du coût fournisseur (best effort).
      if (line.unitCost > 0) {
        await SupplierProduct.updateOne(
          { tenantId, supplierId: order.supplierId, productId: line.product, variantId: line.variantId || null },
          { $set: { lastCost: line.unitCost, currency: line.currency } },
          { session }
        );
      }
    }

    const allReceived = order.lines.every(
      (l) => l.receivedQuantity + l.rejectedQuantity >= l.orderedQuantity
    );
    order.status = allReceived ? 'received' : 'partially_received';
    const ids = new Set((order.receiptMovements || []).map(String));
    movements.forEach((movementId) => ids.add(String(movementId)));
    order.receiptMovements = [...ids];
    await order.save({ session });

    await session.commitTransaction();
    return order;
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) { /* déjà annulée */ }
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createOrder, submitOrder, approveOrder, rejectOrder, cancelOrder, closeOrder, receiveOrder,
};
