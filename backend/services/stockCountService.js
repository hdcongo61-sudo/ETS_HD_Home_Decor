/**
 * StockCountService — inventaires physiques (Phase 4.4).
 *
 * - `create` fige un instantané du stock attendu (expectedQuantity) ;
 * - `post` publie UNIQUEMENT l'écart compté - attendu, via des mouvements
 *   d'ajustement append-only (jamais de modification des mouvements passés) ;
 * - le compteur et l'approbateur sont conservés sur le document.
 */
const mongoose = require('mongoose');
const StockCount = require('../models/stockCountModel');
const Location = require('../models/locationModel');
const { issueStock, receiveStock, ensureDefaultVariantAndBalance } = require('./inventoryService');

const genCode = (prefix) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;

const notFound = () => {
  const err = new Error('Inventaire introuvable dans cette organisation.');
  err.statusCode = 404;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

async function createCount({ tenantId, locationId, productIds, reason, note = '', userId }) {
  const location = await Location.findOne({ tenantId, _id: locationId }).select('_id').lean();
  if (!location) throw conflict('Boutique introuvable dans cette organisation.');

  const uniqueIds = [...new Set((productIds || []).map(String).filter(Boolean))];
  if (uniqueIds.length === 0) throw conflict('Au moins un produit est requis.');

  const lines = [];
  for (const productId of uniqueIds) {
    const { variant, balance } = await ensureDefaultVariantAndBalance(tenantId, locationId, productId, null);
    lines.push({
      product: productId,
      variantId: variant._id,
      expectedQuantity: balance ? balance.onHand : 0,
      countedQuantity: null,
      unitCost: 0,
    });
  }

  return StockCount.create({
    tenantId,
    locationId,
    code: genCode('CNT-'),
    status: 'open',
    reason: String(reason || '').slice(0, 300),
    note: String(note || '').slice(0, 300),
    lines,
    counter: userId,
    openedAt: new Date(),
  });
}

async function postCount({ tenantId, countId, countedQuantities, approverId }) {
  const count = await StockCount.findOne({ tenantId, _id: countId });
  if (!count) throw notFound();
  if (count.status !== 'open') {
    throw conflict(`Impossible de publier un inventaire au statut « ${count.status} ».`);
  }
  const counted = countedQuantities || {};
  const missing = count.lines.filter((line) => !(String(line.product) in counted));
  if (missing.length > 0) {
    throw conflict('Quantité comptée manquante pour une ou plusieurs lignes.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const movements = [];
    for (let i = 0; i < count.lines.length; i += 1) {
      const line = count.lines[i];
      const value = Number(counted[String(line.product)]);
      if (!Number.isFinite(value) || value < 0) {
        await session.abortTransaction();
        throw conflict(`Quantité comptée invalide pour le produit ${line.product}.`);
      }
      const delta = value - line.expectedQuantity;
      line.countedQuantity = value;
      if (delta === 0) continue;

      const base = {
        tenantId,
        locationId: count.locationId,
        productId: line.product,
        unitCost: line.unitCost,
        referenceType: 'stockCount',
        referenceId: count._id,
        idempotencyKey: `count:${count._id}:${i}:adjust`,
        note: `Inventaire ${count.code}`,
        userId: approverId,
      };
      let result;
      if (delta > 0) {
        result = await receiveStock({ ...base, quantity: delta, type: 'adjustment_in' }, session);
      } else {
        result = await issueStock({ ...base, quantity: -delta, type: 'adjustment_out' }, session);
        if (result.insufficient) {
          await session.abortTransaction();
          throw conflict('Stock insuffisant pour enregistrer l\'écart négatif (une vente concurrente a probablement eu lieu).');
        }
      }
      movements.push(result.movement._id);
    }

    count.status = 'posted';
    count.approver = approverId;
    count.postedAt = new Date();
    count.adjustmentMovements = movements;
    await count.save({ session });
    await session.commitTransaction();
    return count;
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) { /* déjà annulée */ }
    throw error;
  } finally {
    session.endSession();
  }
}

async function cancelCount({ tenantId, countId, userId }) {
  const count = await StockCount.findOne({ tenantId, _id: countId });
  if (!count) throw notFound();
  if (count.status !== 'open') {
    throw conflict(`Impossible d'annuler un inventaire au statut « ${count.status} ».`);
  }
  count.status = 'cancelled';
  count.cancelledAt = new Date();
  await count.save();
  return count;
}

module.exports = { createCount, postCount, cancelCount };
