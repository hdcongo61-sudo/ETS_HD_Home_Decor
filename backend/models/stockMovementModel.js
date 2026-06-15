const mongoose = require('mongoose');

/**
 * StockMovement — a non-sale stock reduction (breakage, giveaway, etc.).
 * Reduces product.stock and records WHY + the cost impact (cost price frozen
 * at the time, like sale.profitData), so "Pertes & cadeaux" reporting and the
 * profit loss line can use it. It is NOT a cash expense.
 */
const stockMovementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    // Snapshots so the report stays correct even if the product changes/disappears.
    productName: { type: String, trim: true },
    category: { type: String, trim: true },
    container: { type: String, trim: true },
    warehouse: { type: String, trim: true },

    quantity: { type: Number, required: true, min: 1 }, // units removed
    reason: {
      type: String,
      enum: ['casse', 'cadeau', 'vol', 'peremption', 'usage_personnel', 'correction', 'autre'],
      required: true,
    },
    unitCost: { type: Number, default: 0 }, // cost price at time of movement
    costImpact: { type: Number, default: 0 }, // unitCost * quantity (capital lost)
    note: { type: String, trim: true, maxLength: 300 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source: { type: String, enum: ['direct', 'request'], default: 'direct' },
  },
  { timestamps: true }
);

stockMovementSchema.index({ tenantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, reason: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
