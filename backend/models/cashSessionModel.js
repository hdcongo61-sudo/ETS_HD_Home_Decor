const mongoose = require('mongoose');

/**
 * CashSession — session de caisse (Phase 5.7).
 *
 * Une seule session ouverte par caisse à la fois. À la clôture :
 *   expectedClosing = fond d'ouverture + encaissements cash − dépenses cash
 *                     liées à la session ;
 *   discrepancy     = compté - attendu (écart explicitement enregistré).
 */
const cashSessionSchema = new mongoose.Schema(
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
      index: true,
    },
    registerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashRegister',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    openingFloat: { type: Number, default: 0 },
    expectedClosing: { type: Number, default: null }, // instantané à la clôture
    countedClosing: { type: Number, default: null },
    discrepancy: { type: Number, default: null },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    openedAt: { type: Date, default: Date.now },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cashSessionSchema.index({ tenantId: 1, registerId: 1, status: 1 });

module.exports = mongoose.model('CashSession', cashSessionSchema);
