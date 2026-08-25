const mongoose = require('mongoose');

/**
 * ProductVariant — combinaison vendable d'un produit (Phase 3).
 *
 * Compatibilité : chaque produit reçoit une variante par défaut (isDefault)
 * invisible dans l'UI simple ; `Product.sku/stock/price` restent les champs
 * legacy jusqu'au cutover.
 */
const variantStatusEnum = ['active', 'inactive', 'archived'];

const productVariantSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    optionValues: {
      // ex. { color: 'Noir', size: 'M' } — clés = attributs variantAxis.
      type: Map,
      of: String,
      default: {},
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    barcodes: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: variantStatusEnum,
      default: 'active',
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Un SKU n'est unique que par organisation (et seulement s'il existe).
productVariantSchema.index(
  { tenantId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' }, sku: { $type: 'string' } } }
);
// Une seule variante par défaut par produit.
productVariantSchema.index(
  { tenantId: 1, productId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

module.exports = mongoose.model('ProductVariant', productVariantSchema);
