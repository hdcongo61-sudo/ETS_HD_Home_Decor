const mongoose = require('mongoose');

/**
 * SaleReturn — retour de vente (Phase 5.5).
 *
 * Référence les lignes de la vente d'origine et les quantités retournées.
 * La quantité retournable restante est calculée par le service
 * (vendu - déjà retourné) : un retour ne peut jamais dépasser le vendu.
 *
 * `disposition` décide du sort du stock :
 *   - restocked : retour au registre d'inventaire (mouvement sale_return) ;
 *   - damaged / discarded : aucun réapprovisionnement (traçabilité seulement).
 */
const returnLineSchema = new mongoose.Schema(
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
    disposition: {
      type: String,
      enum: ['restocked', 'damaged', 'discarded'],
      default: 'restocked',
    },
    unitCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleReturnSchema = new mongoose.Schema(
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
    code: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: ['pending', 'posted', 'cancelled'],
      default: 'pending',
      index: true,
    },
    lines: {
      type: [returnLineSchema],
      validate: [(lines) => Array.isArray(lines) && lines.length > 0, 'Au moins une ligne est requise'],
    },
    note: { type: String, trim: true, default: '', maxLength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    postedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    stockMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }],
    refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund', default: null },
  },
  { timestamps: true }
);

saleReturnSchema.index({ tenantId: 1, code: 1 }, { unique: true });
saleReturnSchema.index({ tenantId: 1, saleId: 1, status: 1 });

module.exports = mongoose.model('SaleReturn', saleReturnSchema);
