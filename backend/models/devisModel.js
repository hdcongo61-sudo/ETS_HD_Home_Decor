const mongoose = require('mongoose');

// Devis (quote) — première étape du pipeline commercial devis → proforma →
// vente. Cycle de vie : draft → sent → accepted/rejected, puis converted
// lorsqu'un devis est transformé en facture proforma. `expired` est dérivé
// lorsque validUntil est dépassé sans conversion.
const devisSchema = mongoose.Schema(
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
    reference: {
      type: String,
      required: true,
      trim: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        productName: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      maxLength: 1000,
      default: '',
    },
    validUntil: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'cancelled', 'converted', 'expired'],
      default: 'draft',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    convertedProforma: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proforma',
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

devisSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
devisSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('Devis', devisSchema);
