const mongoose = require('mongoose');

/**
 * PawaPay-initiated subscription payments (mobile money).
 *
 * One row per depositId. The final result (COMPLETED / FAILED) is applied to
 * the tenant's subscription by the webhook handler or by status polling.
 * Completed mobile-money payments are also appended to `Tenant.payments`
 * so the billing history stays in one place (alongside cash recorded by the
 * super-admin).
 */
const subscriptionPaymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    depositId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: '' },
    country: { type: String, default: '' },
    provider: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    months: { type: Number, default: 1, min: 1, max: 12 },
    // Local lifecycle state.
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    // Last status seen from PawaPay (ACCEPTED / PROCESSING / IN_RECONCILIATION / COMPLETED / FAILED).
    pawaStatus: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    providerTransactionId: { type: String, default: '' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
