const mongoose = require('mongoose');

const supplierSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom du fournisseur est requis'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Unicité par boutique : le même nom peut exister chez plusieurs tenants.
supplierSchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Supplier', supplierSchema);
