const mongoose = require('mongoose');

/**
 * Cashier session (session de caisse).
 * Opens with a counted float, runs while sales/expenses happen, and closes
 * with a physical cash count → produces an expected-vs-counted discrepancy
 * and a Z-report. One OPEN session per tenant at a time.
 */
const cashSessionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    // ── Opening ──
    openedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    openedByName: { type: String, default: '' },
    openedAt:     { type: Date, default: Date.now },
    openingFloat: { type: Number, default: 0, min: 0 },
    openingNote:  { type: String, default: '', maxLength: 300 },

    // ── Closing ──
    closedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedByName: { type: String, default: '' },
    closedAt:     { type: Date, default: null },
    countedCash:  { type: Number, default: 0, min: 0 },
    expectedCash: { type: Number, default: 0 },
    discrepancy:  { type: Number, default: 0 }, // countedCash − expectedCash
    closingNote:  { type: String, default: '', maxLength: 300 },

    // ── Snapshot totals (frozen at close) ──
    totals: {
      cashCollected:        { type: Number, default: 0 },
      mobileMoneyCollected: { type: Number, default: 0 },
      creditCollected:      { type: Number, default: 0 },
      totalCollected:       { type: Number, default: 0 },
      cashExpenses:         { type: Number, default: 0 },
      paymentsCount:        { type: Number, default: 0 },
      expensesCount:        { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

cashSessionSchema.index({ tenantId: 1, status: 1 });
cashSessionSchema.index({ tenantId: 1, openedAt: -1 });

module.exports = mongoose.model('CashSession', cashSessionSchema);
