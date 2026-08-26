/**
 * InventoryService — moteur d'inventaire v2 (Phase 4.2a).
 *
 * Commandes transactionnelles :
 *   - issueStock   : décrément atomique (condition onHand >= quantité), mouvement
 *                    append-only, et dual-write `Product.stock` (compatibilité).
 *   - receiveStock : incrément + mouvement + dual-write.
 *
 * Chaque commande accepte une `session` MongoDB externe (elle s'y intègre sans
 * commiter) ou en ouvre une interne (commit/abort automatique).
 * L'idempotence est garantie par `idempotencyKey` (index unique par tenant).
 */
const mongoose = require('mongoose');
const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const InventoryBalance = require('../models/inventoryBalanceModel');
const StockMovement = require('../models/stockMovementModel');

// Résout la variante par défaut du produit (ou la crée) et garantit la balance.
async function ensureDefaultVariantAndBalance(tenantId, locationId, productId, session) {
  const product = await Product.findOne({ tenantId, _id: productId })
    .select('stock costPrice sku')
    .session(session)
    .lean();
  if (!product) {
    const err = new Error('Produit introuvable.');
    err.statusCode = 404;
    throw err;
  }

  let variant = await ProductVariant.findOne({ tenantId, productId, isDefault: true })
    .session(session)
    .lean();
  if (!variant) {
    const [created] = await ProductVariant.create([{
      tenantId,
      productId,
      optionValues: {},
      sku: product.sku || undefined,
      status: 'active',
      isDefault: true,
    }], { session });
    variant = created;
  }

  let balance = await InventoryBalance.findOne({ tenantId, locationId, variantId: variant._id })
    .session(session)
    .lean();
  if (!balance) {
    // Multi-boutiques : si une balance existe déjà ailleurs pour cette
    // variante, la nouvelle boutique démarre à ZÉRO. Initialiser depuis
    // Product.stock ici dupliquerait le stock déjà compté à l'autre boutique.
    const anyBalance = await InventoryBalance.findOne({ tenantId, variantId: variant._id })
      .session(session)
      .lean();
    const stock = anyBalance ? 0 : (Number(product.stock) || 0);
    const [created] = await InventoryBalance.create([{
      tenantId,
      locationId,
      variantId: variant._id,
      productId,
      onHand: stock,
      reserved: 0,
      available: stock,
      version: 1,
    }], { session });
    balance = created;
    if (stock > 0) {
      await StockMovement.create([{
        tenantId,
        locationId,
        product: productId,
        variantId: variant._id,
        productName: null,
        type: 'opening',
        quantityDelta: stock,
        quantity: stock,
        unitCost: Number(product.costPrice) || 0,
        costImpact: 0,
        reason: 'correction',
        source: 'migration',
        idempotencyKey: `opening:${productId}:${locationId}`,
      }], { session });
    }
  }

  return { variant, balance };
}

const findByKey = (tenantId, idempotencyKey, session) =>
  StockMovement.findOne({ tenantId, idempotencyKey }).session(session).lean();

// Défense en profondeur : quand le contexte n'a pas de boutique (X-Location-Id
// absent et fallback du middleware court-circuité), résout la boutique active
// la plus ancienne du tenant.
async function resolveLocationId(tenantId, locationId, session) {
  if (locationId) return locationId;
  const Location = require('../models/locationModel');
  const location = await Location.findOne({ tenantId, isActive: true })
    .sort({ createdAt: 1 })
    .select('_id')
    .session(session)
    .lean();
  if (!location) {
    const err = new Error('Aucune boutique active pour ce tenant.');
    err.statusCode = 400;
    throw err;
  }
  return location._id;
}

// Sortie de stock (vente, casse, transfert sortant…).
async function issueStock({
  tenantId, locationId, productId, quantity, unitCost = 0,
  type = 'sale', referenceType = null, referenceId = null,
  idempotencyKey = null, note = '', userId = null, occurredAt = null,
}, externalSession = null) {
  const ownSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());
  if (ownSession) session.startTransaction();
  try {
    if (idempotencyKey) {
      const existing = await findByKey(tenantId, idempotencyKey, session);
      if (existing) return { alreadyApplied: true, balance: null, movement: existing };
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantité invalide.');
      err.statusCode = 400;
      throw err;
    }

    locationId = await resolveLocationId(tenantId, locationId, session);

    const { variant, balance } = await ensureDefaultVariantAndBalance(tenantId, locationId, productId, session);

    // Décrément atomique : n'autorise jamais un onHand négatif.
    const updated = await InventoryBalance.findOneAndUpdate(
      { tenantId, locationId, variantId: variant._id, onHand: { $gte: qty } },
      { $inc: { onHand: -qty, available: -qty, version: 1 } },
      { session, new: true }
    );
    if (!updated) {
      if (ownSession) await session.abortTransaction();
      return { alreadyApplied: false, balance: null, movement: null, insufficient: true };
    }

    const [movement] = await StockMovement.create([{
      tenantId,
      locationId,
      product: productId,
      variantId: variant._id,
      productName: null,
      type,
      quantityDelta: -qty,
      quantity: qty,
      unitCost: Number(unitCost) || 0,
      costImpact: 0,
      reason: 'correction',
      source: 'direct',
      note: String(note || '').slice(0, 300),
      user: userId,
      idempotencyKey,
      referenceType,
      referenceId,
      occurredAt: occurredAt || new Date(),
    }], { session });

    // Dual-write legacy (compatibilité) — même condition atomique.
    await Product.updateOne(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { session }
    );

    if (ownSession) await session.commitTransaction();
    return { alreadyApplied: false, balance: updated, movement, insufficient: false };
  } catch (error) {
    if (ownSession) await session.abortTransaction();
    throw error;
  } finally {
    if (ownSession) session.endSession();
  }
}

// Entrée de stock (réception, retour, ajustement positif…).
async function receiveStock({
  tenantId, locationId, productId, quantity, unitCost = 0,
  type = 'purchase_receipt', referenceType = null, referenceId = null,
  idempotencyKey = null, note = '', userId = null, occurredAt = null,
}, externalSession = null) {
  const ownSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());
  if (ownSession) session.startTransaction();
  try {
    if (idempotencyKey) {
      const existing = await findByKey(tenantId, idempotencyKey, session);
      if (existing) return { alreadyApplied: true, balance: null, movement: existing };
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantité invalide.');
      err.statusCode = 400;
      throw err;
    }

    locationId = await resolveLocationId(tenantId, locationId, session);

    const { variant } = await ensureDefaultVariantAndBalance(tenantId, locationId, productId, session);

    const updated = await InventoryBalance.findOneAndUpdate(
      { tenantId, locationId, variantId: variant._id },
      { $inc: { onHand: qty, available: qty, version: 1 } },
      { session, new: true }
    );

    const [movement] = await StockMovement.create([{
      tenantId,
      locationId,
      product: productId,
      variantId: variant._id,
      productName: null,
      type,
      quantityDelta: qty,
      quantity: qty,
      unitCost: Number(unitCost) || 0,
      costImpact: 0,
      reason: 'correction',
      source: 'direct',
      note: String(note || '').slice(0, 300),
      user: userId,
      idempotencyKey,
      referenceType,
      referenceId,
      occurredAt: occurredAt || new Date(),
    }], { session });

    await Product.updateOne(
      { _id: productId },
      { $inc: { stock: qty } },
      { session }
    );

    if (ownSession) await session.commitTransaction();
    return { alreadyApplied: false, balance: updated, movement, insufficient: false };
  } catch (error) {
    if (ownSession) await session.abortTransaction();
    throw error;
  } finally {
    if (ownSession) session.endSession();
  }
}

async function getBalance({ tenantId, locationId, productId }, session = null) {
  const { variant, balance } = await ensureDefaultVariantAndBalance(tenantId, locationId, productId, session);
  return balance;
}

// Types inversés pour une annulation append-only (un mouvement n'est jamais
// effacé ni modifié : on lui oppose un mouvement de sens contraire).
const REVERSE_TYPE_MAP = {
  opening: 'adjustment_out',
  purchase_receipt: 'adjustment_out',
  sale: 'sale_return',
  sale_return: 'sale',
  transfer_out: 'adjustment_in',
  transfer_in: 'adjustment_out',
  adjustment_in: 'adjustment_out',
  adjustment_out: 'adjustment_in',
  damage: 'adjustment_in',
  loss: 'adjustment_in',
  gift: 'adjustment_in',
  reservation: 'reservation_release',
  reservation_release: 'reservation',
};

// Annule un mouvement posté en appliquant le delta contraire, dans la même
// boutique, avec référence vers le mouvement d'origine (traçabilité complète).
async function reverseMovement({ tenantId, movementId, userId = null, note = '' }) {
  const movement = await StockMovement.findOne({ tenantId, _id: movementId }).lean();
  if (!movement) {
    const err = new Error('Mouvement introuvable dans cette organisation.');
    err.statusCode = 404;
    throw err;
  }
  const existing = await StockMovement.findOne({
    tenantId, referenceType: 'reversal', referenceId: movement._id,
  }).lean();
  if (existing) return { alreadyApplied: true, movement: existing };

  const reverseDelta = -(Number(movement.quantityDelta) || 0);
  if (reverseDelta === 0) {
    const err = new Error('Ce mouvement ne peut pas être annulé (delta nul).');
    err.statusCode = 400;
    throw err;
  }

  const reverseType = REVERSE_TYPE_MAP[movement.type] || (reverseDelta > 0 ? 'adjustment_in' : 'adjustment_out');
  const base = {
    tenantId,
    locationId: movement.locationId || null,
    productId: movement.product,
    quantity: Math.abs(reverseDelta),
    unitCost: Number(movement.unitCost) || 0,
    referenceType: 'reversal',
    referenceId: movement._id,
    idempotencyKey: `reversal:${movement._id}`,
    note: `Annulation du mouvement ${movement._id}${note ? ` — ${String(note).slice(0, 200)}` : ''}`,
    userId,
  };

  const result = reverseDelta > 0
    ? await receiveStock({ ...base, type: reverseType })
    : await issueStock({ ...base, type: reverseType });
  if (result.insufficient) {
    const err = new Error('Stock insuffisant pour annuler ce mouvement.');
    err.statusCode = 409;
    throw err;
  }
  return { alreadyApplied: false, movement: result.movement };
}

module.exports = { issueStock, receiveStock, getBalance, ensureDefaultVariantAndBalance, reverseMovement };
