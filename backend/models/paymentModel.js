const mongoose = require('mongoose');

/**
 * Payment — collection dédiée des paiements (Phase 5.4).
 *
 * Le tableau embarqué `sale.payments` reste la source legacy en lecture seule
 * pendant le pilote : chaque nouveau paiement est DOUBLE-ÉCRIT ici avec une
 * clé d'idempotence déterministe (`sale:{saleId}:payment:{index}`).
 */
const paymentSchema = new mongoose.Schema(
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
    },
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
    externalReference: { type: String, trim: true, default: null },
    idempotencyKey: { type: String, trim: true, default: null },
    cashSessionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    paidAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reversalReason: { type: String, trim: true, default: '' },
    reversedAt: { type: Date, default: null },
    note: { type: String, trim: true, default: '', maxLength: 300 },
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, saleId: 1, paidAt: -1 });
paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
