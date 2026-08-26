const mongoose = require('mongoose');

/**
 * SupplierProduct — relation N-N fournisseur ↔ produit (Phase 6.2).
 *
 * Références d'achat : SKU fournisseur, unité d'achat et conversion,
 * dernier coût, quantité minimum, délai, préférence.
 */
const supplierProductSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    supplierSku: { type: String, trim: true, default: '' },
    purchaseUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitOfMeasure',
      default: null,
    },
    conversionToBase: { type: Number, default: 1, min: 0.000001 },
    lastCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, uppercase: true, trim: true, default: 'XOF' },
    minimumOrderQuantity: { type: Number, default: 1, min: 1 },
    leadTimeDays: { type: Number, default: 0, min: 0 },
    preferred: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

supplierProductSchema.index(
  { tenantId: 1, supplierId: 1, productId: 1, variantId: 1 },
  { unique: true }
);
supplierProductSchema.index({ tenantId: 1, productId: 1 });

module.exports = mongoose.model('SupplierProduct', supplierProductSchema);
