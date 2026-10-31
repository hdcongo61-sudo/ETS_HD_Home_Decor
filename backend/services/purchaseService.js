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
const Tenant = require('../models/tenantModel');
const Location = require('../models/locationModel');
const StockMovement = require('../models/stockMovementModel');
const SupplierInvoice = require('../models/supplierInvoiceModel');
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

async function recordReceivedPurchase({
  tenantId,
  locationId,
  supplierId,
  lines,
  invoiceNumber = '',
  purchaseDate = null,
  paymentMethod = 'cash',
  note = '',
  sourceRequestId,
  isAdmin = false,
  userId = null,
}) {
  if (!sourceRequestId || typeof sourceRequestId !== 'string' || sourceRequestId.length > 100) {
    throw badRequest('Identifiant de demande requis.');
  }

  const existing = await PurchaseOrder.findOne({ tenantId, sourceRequestId }).lean();
  if (existing) {
    const invoice = await SupplierInvoice.findOne({ tenantId, purchaseOrderIds: existing._id }).lean();
    return { order: existing, invoice, alreadyApplied: true };
  }

  if (!mongoose.isValidObjectId(locationId)) throw badRequest('Boutique requise pour cet achat.');
  if (!mongoose.isValidObjectId(supplierId)) throw badRequest('Fournisseur requis pour cet achat.');
  const location = await Location.findOne({ tenantId, _id: locationId }).select('_id').lean();
  if (!location) throw conflict('Boutique introuvable dans cette organisation.');
  const supplier = await Supplier.findOne({ tenantId, _id: supplierId }).select('_id name currency').lean();
  if (!supplier) throw conflict('Fournisseur introuvable dans cette organisation.');
  if (!Array.isArray(lines) || lines.length === 0 || lines.some((line) => !line || typeof line !== 'object')) {
    throw badRequest('Ajoutez au moins un produit valide à cet achat.');
  }
  const paymentMethods = ['cash', 'bank_transfer', 'MobileMoney', 'check', 'other'];
  if (!paymentMethods.includes(paymentMethod)) throw badRequest('Mode de paiement invalide.');
  if (lines.some((line) => line?.newProduct) && !isAdmin) {
    const error = new Error('Seul un administrateur peut créer un nouveau produit.');
    error.statusCode = 403;
    throw error;
  }

  const date = purchaseDate ? new Date(purchaseDate) : new Date();
  if (Number.isNaN(date.getTime())) throw badRequest('Date d’achat invalide.');

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const newProductCount = lines.filter((line) => line.newProduct).length;
    if (newProductCount > 0) {
      const tenant = await Tenant.findById(tenantId).select('maxProducts').session(session).lean();
      const currentCount = await Product.countDocuments({ tenantId }).session(session);
      const maxProducts = Number(tenant?.maxProducts) || 500;
      if (currentCount + newProductCount > maxProducts) {
        const error = new Error(`Limite atteinte : votre forfait autorise ${maxProducts} produit(s) maximum.`);
        error.statusCode = 403;
        throw error;
      }
    }

    const normalizedLines = [];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest('Quantité invalide.');
      if (!Number.isFinite(unitCost) || unitCost < 0) throw badRequest('Prix d’achat invalide.');

      let product;
      if (line.newProduct) {
        const name = String(line.newProduct.name || '').trim();
        const category = String(line.newProduct.category || '').trim();
        const price = Number(line.newProduct.price);
        if (!name || !category || !Number.isFinite(price) || price < 0) {
          throw badRequest('Un nouveau produit doit avoir un nom, une catégorie et un prix de vente valide.');
        }
        [product] = await Product.create([{
          tenantId,
          name,
          description: String(line.newProduct.description || name).trim(),
          category,
          price,
          costPrice: unitCost,
          stock: 0,
          supplierName: supplier.name,
          createdBy: userId,
          updatedBy: userId,
          activities: [{
            type: 'creation',
            description: 'Produit créé lors de l’enregistrement d’un achat',
            user: userId,
          }],
        }], { session });
      } else {
        if (!mongoose.isValidObjectId(line.productId)) throw badRequest('Sélectionnez un produit valide.');
        product = await Product.findOne({ tenantId, _id: line.productId })
          .select('name')
          .session(session)
          .lean();
        if (!product) throw conflict('Un produit de cet achat est introuvable dans cette organisation.');
      }

      normalizedLines.push({
        product: product._id,
        description: String(line.description || product.name).trim().slice(0, 300),
        orderedQuantity: quantity,
        receivedQuantity: quantity,
        rejectedQuantity: 0,
        unitCost,
        currency: supplier.currency || 'XOF',
      });
    }

    const sequence = await nextNumber({
      tenantId,
      locationId,
      docType: 'PO',
      fiscalPeriod: String(date.getFullYear()),
    });
    const code = `PO-${sequence.fiscalPeriod}-${String(sequence.seq).padStart(4, '0')}`;
    const totalAmount = round2(normalizedLines.reduce(
      (sum, line) => sum + line.orderedQuantity * line.unitCost,
      0
    ));
    const [order] = await PurchaseOrder.create([{
      tenantId,
      locationId,
      supplierId,
      sourceRequestId,
      code,
      status: 'received',
      lines: normalizedLines,
      totalAmount,
      currency: supplier.currency || 'XOF',
      note: String(note || '').slice(0, 500),
      requestedBy: userId,
    }], { session });

    const movements = [];
    for (let index = 0; index < normalizedLines.length; index += 1) {
      const line = normalizedLines[index];
      const result = await receiveStock({
        tenantId,
        locationId,
        productId: line.product,
        quantity: line.orderedQuantity,
        unitCost: line.unitCost,
        type: 'purchase_receipt',
        referenceType: 'purchaseOrder',
        referenceId: order._id,
        idempotencyKey: `received-purchase:${sourceRequestId}:${index}`,
        note: `Réception ${code}`,
        userId,
        occurredAt: date,
      }, session);
      movements.push(result.movement._id);

      if (line.unitCost > 0) {
        await SupplierProduct.updateOne(
          { tenantId, supplierId, productId: line.product, variantId: null },
          { $set: { lastCost: line.unitCost, currency: line.currency } },
          { upsert: true, session }
        );
      }
    }

    order.receiptMovements = movements;
    await order.save({ session });

    const reference = String(invoiceNumber || '').trim().slice(0, 80) || `ACHAT-${code}`;
    const [invoice] = await SupplierInvoice.create([{
      tenantId,
      supplierId,
      invoiceNumber: reference,
      purchaseOrderIds: [order._id],
      issueDate: date,
      currency: supplier.currency || 'XOF',
      status: 'paid',
      lines: normalizedLines.map((line) => ({
        product: line.product,
        description: line.description,
        quantity: line.orderedQuantity,
        unitCost: line.unitCost,
        lineTotal: round2(line.orderedQuantity * line.unitCost),
      })),
      subtotal: totalAmount,
      taxTotal: 0,
      totalAmount,
      paidAmount: totalAmount,
      payments: totalAmount > 0 ? [{ amount: totalAmount, method: paymentMethod, date, paidBy: userId }] : [],
      note: String(note || '').slice(0, 500),
      createdBy: userId,
      postedBy: userId,
      postedAt: date,
    }], { session });

    await session.commitTransaction();
    return { order, invoice, alreadyApplied: false };
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) { /* transaction already ended */ }
    if (error?.code === 11000) {
      const duplicate = await PurchaseOrder.findOne({ tenantId, sourceRequestId }).lean();
      if (duplicate) {
        const invoice = await SupplierInvoice.findOne({ tenantId, purchaseOrderIds: duplicate._id }).lean();
        return { order: duplicate, invoice, alreadyApplied: true };
      }
    }
    throw error;
  } finally {
    session.endSession();
  }
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
  createOrder, recordReceivedPurchase, submitOrder, approveOrder, rejectOrder, cancelOrder, closeOrder, receiveOrder,
};
