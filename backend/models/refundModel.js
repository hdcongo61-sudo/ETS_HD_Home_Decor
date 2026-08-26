const mongoose = require('mongoose');

/**
 * Refund — remboursement (Phase 5.5).
 *
 * Référence un ou plusieurs paiements et éventuellement le retour/avoir lié.
 * Les paiements remboursés sont marqués `reversed` (jamais supprimés).
 */
const refundSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    saleReturnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleReturn',
      default: null,
    },
    paymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
    amount: {
      type: Number,
      required: true,
      set: (v) => parseFloat(v.toFixed(2)),
      min: [0, 'Le montant ne peut pas être négatif'],
    },
    currency: { type: String, default: 'XOF', uppercase: true, trim: true },
    method: {
      type: String,
      enum: ['cash', 'MobileMoney', 'credit', 'bank'],
      default: 'cash',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
      index: true,
    },
    reason: { type: String, trim: true, default: '', maxLength: 300 },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: Date.now },
    externalReference: { type: String, trim: true, default: null },
    idempotencyKey: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: '', maxLength: 300 },
  },
  { timestamps: true }
);

refundSchema.index({ tenantId: 1, saleId: 1, processedAt: -1 });
refundSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Refund', refundSchema);
