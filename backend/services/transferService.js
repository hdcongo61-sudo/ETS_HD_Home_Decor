/**
 * TransferService — machine à états des transferts de stock (Phase 4.3).
 *
 *   draft → submitted → shipped → received
 *                    ↘ cancelled
 *
 * - `ship` sort le stock de la boutique source (transfer_out) ;
 * - `receive` entre le stock dans la destination (transfer_in) ;
 * - réception partielle : seules les quantités indiquées sont reçues, l'écart
 *   reste visible (shippedQuantity vs receivedQuantity) ;
 * - chaque ligne possède une clé d'idempotence déterministe : un double appel
 *   ne sort/reçoit jamais deux fois le même stock.
 */
const mongoose = require('mongoose');
const StockTransfer = require('../models/stockTransferModel');
const Location = require('../models/locationModel');
const { issueStock, receiveStock } = require('./inventoryService');

const genCode = (prefix) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;

const notFound = () => {
  const err = new Error('Transfert introuvable dans cette organisation.');
  err.statusCode = 404;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

async function createTransfer({
  tenantId, sourceLocationId, destinationLocationId, lines, note = '', userId = null,
}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw conflict('Au moins une ligne est requise.');
  }
  if (String(sourceLocationId) === String(destinationLocationId)) {
    throw conflict('La boutique source et la destination doivent être différentes.');
  }
  const locations = await Location.find({
    tenantId, _id: { $in: [sourceLocationId, destinationLocationId] },
  }).select('_id isStockLocation').lean();
  if (locations.length !== 2) {
    throw conflict('Boutique source ou destination introuvable dans cette organisation.');
  }

  const transfer = await StockTransfer.create({
    tenantId,
    code: genCode('TRF-'),
    sourceLocationId,
    destinationLocationId,
    status: 'draft',
    lines: lines.map((line) => ({
      product: line.product,
      variantId: line.variantId || null,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost) || 0,
      shippedQuantity: 0,
      receivedQuantity: 0,
    })),
    note: String(note || '').slice(0, 300),
    createdBy: userId,
  });
  return transfer;
}

async function shipTransfer({ tenantId, transferId, userId = null }) {
  const transfer = await StockTransfer.findOne({ tenantId, _id: transferId });
  if (!transfer) throw notFound();
  if (!['draft', 'submitted'].includes(transfer.status)) {
    throw conflict(`Impossible d'expédier un transfert au statut « ${transfer.status} ».`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const movements = [];
    for (let i = 0; i < transfer.lines.length; i += 1) {
      const line = transfer.lines[i];
      const result = await issueStock({
        tenantId,
        locationId: transfer.sourceLocationId,
        productId: line.product,
        quantity: line.quantity,
        unitCost: line.unitCost,
        type: 'transfer_out',
        referenceType: 'stockTransfer',
        referenceId: transfer._id,
        idempotencyKey: `transfer:${transfer._id}:${i}:out`,
        note: `Transfert ${transfer.code}`,
        userId,
      }, session);
      if (result.insufficient) {
        await session.abortTransaction();
        throw conflict('Stock insuffisant dans la boutique source. Le transfert n\'a pas été expédié.');
      }
      line.shippedQuantity = line.quantity;
      movements.push(result.movement._id);
    }

    transfer.status = 'shipped';
    transfer.shippedBy = userId;
    transfer.shippedAt = new Date();
    transfer.transferOutMovements = movements;
    await transfer.save({ session });
    await session.commitTransaction();
    return transfer;
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) { /* déjà annulée */ }
    throw error;
  } finally {
    session.endSession();
  }
}

async function receiveTransfer({ tenantId, transferId, userId = null, receivedQuantities = null }) {
  const transfer = await StockTransfer.findOne({ tenantId, _id: transferId });
  if (!transfer) throw notFound();
  if (transfer.status !== 'shipped') {
    throw conflict(`Impossible de recevoir un transfert au statut « ${transfer.status} ».`);
  }

  const requested = receivedQuantities || {};
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const movements = [];
    for (let i = 0; i < transfer.lines.length; i += 1) {
      const line = transfer.lines[i];
      const alreadyReceived = line.receivedQuantity || 0;
      const remaining = (line.shippedQuantity || 0) - alreadyReceived;
      if (remaining <= 0) continue;

      let toReceive = remaining;
      if (String(line.product) in requested) {
        const wanted = Number(requested[String(line.product)]);
        if (!Number.isFinite(wanted) || wanted < 0 || wanted > remaining) {
          await session.abortTransaction();
          throw conflict(`Quantité reçue invalide pour le produit ${line.product} (0..${remaining}).`);
        }
        toReceive = wanted;
      }
      if (toReceive <= 0) continue;

      const result = await receiveStock({
        tenantId,
        locationId: transfer.destinationLocationId,
        productId: line.product,
        quantity: toReceive,
        unitCost: line.unitCost,
        type: 'transfer_in',
        referenceType: 'stockTransfer',
        referenceId: transfer._id,
        idempotencyKey: `transfer:${transfer._id}:${i}:in:${alreadyReceived}`,
        note: `Réception transfert ${transfer.code}`,
        userId,
      }, session);
      const effective = result.alreadyApplied ? result.movement.quantity : toReceive;
      line.receivedQuantity = alreadyReceived + effective;
      movements.push(result.movement._id);
    }

    const ids = new Set(transfer.transferInMovements.map(String));
    movements.forEach((movementId) => ids.add(String(movementId)));
    transfer.transferInMovements = [...ids];

    const fullyReceived = transfer.lines.every(
      (line) => (line.receivedQuantity || 0) >= (line.shippedQuantity || 0)
    );
    if (fullyReceived) {
      transfer.status = 'received';
      transfer.receivedBy = userId;
      transfer.receivedAt = new Date();
    }
    await transfer.save({ session });
    await session.commitTransaction();
    return transfer;
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) { /* déjà annulée */ }
    throw error;
  } finally {
    session.endSession();
  }
}

async function cancelTransfer({ tenantId, transferId, userId = null }) {
  const transfer = await StockTransfer.findOne({ tenantId, _id: transferId });
  if (!transfer) throw notFound();
  if (!['draft', 'submitted'].includes(transfer.status)) {
    throw conflict(`Impossible d'annuler un transfert au statut « ${transfer.status} ».`);
  }
  transfer.status = 'cancelled';
  transfer.cancelledBy = userId;
  transfer.cancelledAt = new Date();
  await transfer.save();
  return transfer;
}

module.exports = { createTransfer, shipTransfer, receiveTransfer, cancelTransfer };
