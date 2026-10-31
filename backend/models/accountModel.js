const mongoose = require('mongoose');

// Plan comptable — compte du grand livre (actif, passif, capitaux propres,
// produits, charges). Un compte appartient à un tenant et peut être parent
// d'autres comptes (hiérarchie simple).
const accountSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Le code du compte est requis'],
      trim: true,
      maxlength: 20,
    },
    name: {
      type: String,
      required: [true, 'Le libellé du compte est requis'],
      trim: true,
      maxlength: 120,
    },
    type: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      required: [true, 'Le type de compte est requis'],
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

accountSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Account', accountSchema);
