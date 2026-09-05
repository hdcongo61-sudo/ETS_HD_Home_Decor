/**
 * ReturnService — retours et remboursements (Phase 5.5).
 *
 * - `createReturn` : valide la quantité retournable restante par ligne
 *   (vendu - déjà retourné) et crée le retour au statut `pending`.
 * - `postReturn` : transaction unique — réapprovisionne les lignes
 *   `restocked` (mouvements sale_return), crée le Refund (garde anti
 *   sur-remboursement) et inverse les paiements référencés ; met à jour le
 *   statut de la vente (`partially_returned` / `returned`).
 * - `cancelReturn` : annule un retour non posté.
 */
const mongoose = require('mongoose');
const Sale = require('../models/saleModel');
const SaleReturn = require('../models/saleReturnModel');
const Refund = require('../models/refundModel');
const Payment = require('../models/paymentModel');
const BankTransaction = require('../models/bankTransactionModel');
const { receiveStock } = require('./inventoryService');
const { reversePayment } = require('./paymentService');

const genCode = (prefix) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;

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

async function returnedQuantitiesByProduct(tenantId, saleId, session = null, { includePending = false } = {}) {
  const statusFilter = includePending
    ? { $in: ['pending', 'posted'] }
    : 'posted';
  const returns = await SaleReturn.find({ tenantId, saleId, status: statusFilter })
    .select('lines')
    .session(session)
    .lean();
  const map = new Map();
  for (const ret of returns) {
    for (const line of ret.lines) {
      const key = String(line.product);
      map.set(key, (map.get(key) || 0) + line.quantity);
    }
  }
  return map;
}

async function createReturn({ tenantId, locationId, saleId, lines, note = '', userId = null }) {
  const sale = await Sale.findOne({ tenantId, _id: saleId }).select('status products client').lean();
  if (!sale) throw notFound('Vente introuvable dans cette organisation.');
  if (sale.status === 'cancelled') throw conflict('Impossible de retourner des articles d\'une vente annulée.');
  if (!Array.isArray(lines) || lines.length === 0) throw conflict('Au moins une ligne est requise.');

  const soldByProduct = new Map(
    (sale.products || []).map((line) => [String(line.product), line.quantity])
  );
  const alreadyReturned = await returnedQuantitiesByProduct(tenantId, saleId, null, { includePending: true });

  const normalized = [];
  for (const line of lines) {
    const productId = String(line.product);
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw conflict('Quantité retournée invalide.');
    }
    const sold = soldByProduct.get(productId);
    if (!sold) throw conflict('Ce produit ne figure pas dans la vente.');
    const maxReturnable = sold - (alreadyReturned.get(productId) || 0);
    if (quantity > maxReturnable) {
      throw conflict(`Quantité retournable insuffisante (maximum: ${maxReturnable}).`);
    }
    if (!['restocked', 'damaged', 'discarded'].includes(line.disposition || 'restocked')) {
      throw conflict('Disposition invalide (restocked, damaged ou discarded).');
    }
    normalized.push({
      product: productId,
      variantId: line.variantId || null,
      quantity,
      disposition: line.disposition || 'restocked',
      unitCost: Number(line.unitCost) || 0,
    });
  }

  return SaleReturn.create({
    tenantId,
    locationId: locationId || null,
    saleId,
    code: genCode('RTN-'),
    status: 'pending',
    lines: normalized,
    note: String(note || '').slice(0, 300),
    createdBy: userId,
  });
}

/**
 * Émet un remboursement après vérification du plafond remboursable
 * (payé - déjà remboursé) et inversion des paiements référencés.
 * `externalSession` : la commande s'y intègre sans commiter.
 */
async function createRefund({
  tenantId, locationId = null, saleId, amount, method = 'cash', currency = 'XOF',
  reason = '', paymentIds = [], userId = null, idempotencyKey = null,
  saleReturnId = null,
}, externalSession = null) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw conflict('Montant de remboursement invalide.');

  if (idempotencyKey) {
    const existing = await Refund.findOne({ tenantId, idempotencyKey }).session(externalSession).lean();
    if (existing) return { alreadyApplied: true, refund: existing };
  }

  const sale = await Sale.findOne({ tenantId, _id: saleId }).select('_id').session(externalSession).lean();
  if (!sale) throw notFound('Vente introuvable dans cette organisation.');

  // Les agrégations ne castent pas les ObjectId : on normalise l'id de vente
  // (le frontend l'envoie en chaîne), sinon le plafond remboursable serait 0.
  const saleIdForMatch = mongoose.Types.ObjectId.isValid(saleId)
    ? new mongoose.Types.ObjectId(saleId)
    : saleId;

  // Total payé = paiements completed + reversed (l'argent reçu puis remboursé
  // compte toujours dans l'enveloppe ; les Refund réduisent le plafond).
  const paidRows = await Payment.aggregate([
    { $match: { tenantId, saleId: saleIdForMatch, status: { $in: ['completed', 'reversed'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).session(externalSession);
  const paidTotal = paidRows.length ? paidRows[0].total : 0;

  const refundedRows = await Refund.aggregate([
    { $match: { tenantId, saleId: saleIdForMatch, status: { $ne: 'reversed' } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).session(externalSession);
  const alreadyRefunded = refundedRows.length ? refundedRows[0].total : 0;

  const refundable = paidTotal - alreadyRefunded;
  if (value > refundable + 0.005) {
    throw conflict(`Montant de remboursement supérieur au remboursable (${refundable.toFixed(2)} CFA).`);
  }

  for (const paymentId of paymentIds || []) {
    const payment = await Payment.findOne({ tenantId, _id: paymentId, saleId })
      .session(externalSession).lean();
    if (!payment) throw conflict('Un paiement référencé n\'appartient pas à cette vente.');
  }

  const [refund] = await Refund.create([{
    tenantId,
    locationId,
    saleId,
    saleReturnId,
    paymentIds: paymentIds || [],
    amount: value,
    currency,
    method,
    status: 'completed',
    reason: String(reason || '').slice(0, 300),
    processedBy: userId,
    processedAt: new Date(),
    idempotencyKey,
  }], externalSession ? { session: externalSession } : {});

  // Sortie de caisse : l'argent repart physiquement (sauf avoir).
  // Idempotent via la clé du Refund : en cas de rejeu, `alreadyApplied`
  // coupe court avant cette écriture.
  if (method !== 'credit' && userId) {
    const saleRef = sale._id ? String(sale._id).slice(-6).toUpperCase() : '';
    await BankTransaction.create([{
      tenantId,
      locationId,
      user: userId,
      type: 'withdraw',
      amount: value,
      label: `Remboursement ${saleRef ? `vente ${saleRef}` : ''}${reason ? ` — ${String(reason).slice(0, 120)}` : ''}`.trim(),
    }], externalSession ? { session: externalSession } : {});
  }

  for (const paymentId of paymentIds || []) {
    await reversePayment({
      tenantId, paymentId, reversalReason: `Remboursement ${reason || ''}`.trim(), reversedBy: userId,
    }, externalSession);
  }

  return { alreadyApplied: false, refund };
}

async function postReturn({ tenantId, returnId, userId = null, refund = null, paymentIds = [] }) {
  const ret = await SaleReturn.findOne({ tenantId, _id: returnId });
  if (!ret) throw notFound('Retour introuvable dans cette organisation.');
  if (ret.status !== 'pending') throw conflict(`Impossible de poster un retour au statut « ${ret.status} ».`);

  const refundAmount = refund ? Number(refund.amount) : 0;
  if (refund && (!Number.isFinite(refundAmount) || refundAmount <= 0)) {
    throw conflict('Montant de remboursement invalide.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const movements = [];
    // 1. Réapprovisionnement des lignes restocked.
    for (let i = 0; i < ret.lines.length; i += 1) {
      const line = ret.lines[i];
      if (line.disposition !== 'restocked') continue;
      const result = await receiveStock({
        tenantId,
        locationId: ret.locationId || null,
        productId: line.product,
        quantity: line.quantity,
        unitCost: line.unitCost,
        type: 'sale_return',
        referenceType: 'saleReturn',
        referenceId: ret._id,
        idempotencyKey: `return:${ret._id}:${i}:restock`,
        note: `Retour ${ret.code}`,
        userId,
      }, session);
      movements.push(result.movement._id);
    }

    // 2. Remboursement éventuel (mêmes gardes que createRefund, même txn).
    let refundDoc = null;
    if (refund && Number(refund.amount) > 0) {
      const result = await createRefund({
        tenantId,
        locationId: ret.locationId || null,
        saleId: ret.saleId,
        amount: refund.amount,
        method: refund.method || 'cash',
        currency: refund.currency || 'XOF',
        reason: refund.reason || `Retour ${ret.code}`,
        paymentIds,
        userId,
        idempotencyKey: `refund:${ret._id}`,
        saleReturnId: ret._id,
      }, session);
      refundDoc = result.refund;
    }

    // 3. Poster le retour.
    ret.status = 'posted';
    ret.postedBy = userId;
    ret.postedAt = new Date();
    ret.stockMovements = movements;
    ret.refundId = refundDoc ? refundDoc._id : null;
    await ret.save({ session });

    // 4. Statut de la vente (distinct du paiement).
    const sale = await Sale.findOne({ tenantId, _id: ret.saleId }).session(session);
    if (sale && sale.status !== 'cancelled') {
      const postedTotals = await returnedQuantitiesByProduct(tenantId, ret.saleId, session);
      const soldByProduct = new Map(
        (sale.products || []).map((line) => [String(line.product), line.quantity])
      );
      const fullyReturned = [...soldByProduct.keys()].every(
        (key) => (postedTotals.get(key) || 0) >= soldByProduct.get(key)
      );
      if (fullyReturned) {
        sale.status = 'returned';
      } else if (!['partially_returned', 'returned'].includes(sale.status)) {
        sale.status = 'partially_returned';
      }
      await sale.save({ session });
    }

    await session.commitTransaction();
    return { ret, refund: refundDoc };
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) { /* déjà annulée */ }
    throw error;
  } finally {
    session.endSession();
  }
}

async function cancelReturn({ tenantId, returnId, userId = null }) {
  const ret = await SaleReturn.findOne({ tenantId, _id: returnId });
  if (!ret) throw notFound('Retour introuvable dans cette organisation.');
  if (ret.status !== 'pending') {
    throw conflict(`Impossible d'annuler un retour au statut « ${ret.status} ».`);
  }
  ret.status = 'cancelled';
  ret.cancelledAt = new Date();
  await ret.save();
  return ret;
}

// Liste des retours d'une vente (lecture, tenant-scopée).
async function listReturnsBySale({ tenantId, saleId }) {
  return SaleReturn.find({ tenantId, saleId }).sort({ createdAt: -1 }).lean();
}

// Liste globale des retours (lecture, tenant-scopée) — affichage d'ensemble.
async function listAllReturns({ tenantId, limit = 200 }) {
  return SaleReturn.find({ tenantId }).sort({ createdAt: -1 }).limit(limit).lean();
}

// Liste des remboursements (lecture, tenant-scopée).
async function listRefunds({ tenantId, saleId = null }) {
  const filter = { tenantId };
  if (saleId) filter.saleId = saleId;
  return Refund.find(filter).sort({ createdAt: -1 }).lean();
}

module.exports = { createReturn, postReturn, cancelReturn, createRefund, listReturnsBySale, listAllReturns, listRefunds };
