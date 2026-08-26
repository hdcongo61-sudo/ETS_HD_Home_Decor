const mongoose = require('mongoose');

/**
 * SupplierInvoice — facture fournisseur et dette (Phase 6.6).
 *
 * Fondation payable : échéance, devise, totaux, paiements et statut.
 * Les écarts commande/réception/facture sont détectables par le service.
 */
const invoiceLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    description: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const invoicePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'bank_transfer', 'MobileMoney', 'check', 'other'], default: 'cash' },
    date: { type: Date, default: Date.now },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const supplierInvoiceSchema = new mongoose.Schema(
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
    invoiceNumber: { type: String, required: true, trim: true, uppercase: true },
    purchaseOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }],
    shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InboundShipment', default: null },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    currency: { type: String, uppercase: true, trim: true, default: 'XOF' },
    status: {
      type: String,
      enum: ['draft', 'posted', 'partially_paid', 'paid', 'cancelled'],
      default: 'draft',
      index: true,
    },
    lines: {
      type: [invoiceLineSchema],
      validate: [(lines) => Array.isArray(lines) && lines.length > 0, 'Au moins une ligne est requise'],
    },
    subtotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    payments: { type: [invoicePaymentSchema], default: [] },
    note: { type: String, trim: true, default: '', maxLength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    postedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supplierInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
supplierInvoiceSchema.index({ tenantId: 1, supplierId: 1, status: 1 });

module.exports = mongoose.model('SupplierInvoice', supplierInvoiceSchema);
