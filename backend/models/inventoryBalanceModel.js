const mongoose = require('mongoose');

/**
 * InventoryBalance — projection rapide du stock par variante et emplacement
 * (Phase 4). Reconstruisible depuis les StockMovement ; `version` sert de
 * contrôle de concurrence pour les mises à jour atomiques.
 */
const inventoryBalanceSchema = mongoose.Schema(
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
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Une seule balance par (organisation, emplacement, variante).
inventoryBalanceSchema.index({ tenantId: 1, locationId: 1, variantId: 1 }, { unique: true });
inventoryBalanceSchema.index({ tenantId: 1, productId: 1 });

module.exports = mongoose.model('InventoryBalance', inventoryBalanceSchema);
