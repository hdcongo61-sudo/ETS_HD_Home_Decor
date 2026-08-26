const mongoose = require('mongoose');

/**
 * Supplier — fiche fournisseur étendue (Phase 6.1).
 *
 * `normalizedName` sert à la détection de doublons inter-casse/espaces ;
 * l'unicité reste par organisation (jamais globale).
 */
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['main', 'billing', 'shipping', 'other'], default: 'main' },
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

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
    normalizedName: {
      type: String,
      trim: true,
      default: '',
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    legalName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    contacts: { type: [contactSchema], default: [] },
    addresses: { type: [addressSchema], default: [] },
    currency: { type: String, uppercase: true, trim: true, default: 'XOF' },
    paymentTerms: { type: String, trim: true, default: '' },
    leadTimeDays: { type: Number, default: 0, min: 0 },
    taxId: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Unicité par organisation : le même nom peut exister chez plusieurs tenants.
supplierSchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' } } }
);
supplierSchema.index(
  { tenantId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' }, normalizedName: { $type: 'string' } } }
);

module.exports = mongoose.model('Supplier', supplierSchema);
