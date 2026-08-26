const mongoose = require('mongoose');

/**
 * PurchaseOrder — bon de commande fournisseur (Phase 6.3).
 *
 * Machine à états :
 *   draft → submitted → approved → partially_received → received → closed
 *                ↘ rejected / cancelled
 *
 * Les lignes enregistrent un instantané de description, la quantité
 * commandée, reçue et rejetée, le coût unitaire et la date attendue.
 */
const purchaseOrderLineSchema = new mongoose.Schema(
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
    description: { type: String, trim: true, default: '' },
    orderedQuantity: { type: Number, required: true, min: 1 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    rejectedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, uppercase: true, trim: true, default: 'XOF' },
    taxRate: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    expectedDate: { type: Date, default: null },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
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
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: [
        'draft', 'submitted', 'approved',
        'partially_received', 'received', 'closed',
        'rejected', 'cancelled',
      ],
      default: 'draft',
      index: true,
    },
    lines: {
      type: [purchaseOrderLineSchema],
      validate: [(lines) => Array.isArray(lines) && lines.length > 0, 'Au moins une ligne est requise'],
    },
    totalAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, uppercase: true, trim: true, default: 'XOF' },
    note: { type: String, trim: true, default: '', maxLength: 500 },
    expectedDate: { type: Date, default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
    receiptMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }],
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ tenantId: 1, code: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, status: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
