const mongoose = require('mongoose');

/**
 * StockTransfer — transfert de stock inter-boutiques (Phase 4.3).
 *
 * Machine à états : draft → submitted → shipped → received
 *                                    ↘ cancelled
 *
 * Le `shippedQuantity` (réellement sorti) et le `receivedQuantity`
 * (réellement reçu) sont enregistrés séparément de la quantité demandée :
 * un écart de réception est donc toujours explicite, jamais silencieux.
 */
const transferLineSchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitCost: { type: Number, default: 0 },
    shippedQuantity: { type: Number, default: 0 },
    receivedQuantity: { type: Number, default: 0 },
  },
  { _id: false }
);

const stockTransferSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sourceLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    destinationLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'shipped', 'received', 'cancelled'],
      default: 'draft',
      index: true,
    },
    note: { type: String, trim: true, default: '' },
    lines: {
      type: [transferLineSchema],
      validate: [(lines) => Array.isArray(lines) && lines.length > 0, 'Au moins une ligne est requise'],
    },
    // Mouvements de sortie (source) et d'entrée (destination) liés.
    transferOutMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }],
    transferInMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shippedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shippedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

stockTransferSchema.index({ tenantId: 1, code: 1 }, { unique: true });
stockTransferSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
