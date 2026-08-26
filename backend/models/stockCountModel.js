const mongoose = require('mongoose');

/**
 * StockCount — inventaire physique (Phase 4.4).
 *
 * À l'ouverture, le comptage fige le stock attendu (`expectedQuantity`) pour
 * chaque ligne. L'approbation (`post`) enregistre la quantité comptée et ne
 * publie QUE l'écart, sous forme de mouvements d'ajustement append-only.
 * Compteur, approbateur, motif et horodatages sont conservés.
 */
const countLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    expectedQuantity: { type: Number, default: 0 }, // instantané au démarrage
    countedQuantity: { type: Number, default: null }, // saisi à l'approbation
    unitCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const stockCountSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: ['open', 'posted', 'cancelled'],
      default: 'open',
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxLength: 300 },
    note: { type: String, trim: true, default: '' },
    lines: {
      type: [countLineSchema],
      validate: [(lines) => Array.isArray(lines) && lines.length > 0, 'Au moins une ligne est requise'],
    },
    counter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    openedAt: { type: Date, default: Date.now },
    postedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    adjustmentMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }],
  },
  { timestamps: true }
);

stockCountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
stockCountSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('StockCount', stockCountSchema);
