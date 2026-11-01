const mongoose = require('mongoose');

// Immobilisation (actif fixe) amortissable en linéaire. L'amortissement est
// calculé (coût − valeur résiduelle) / durée de vie, puis comptabilisé dans le
// grand livre via une écriture (681 dotations / 281 amortissements cumulés).
const fixedAssetSchema = mongoose.Schema(
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
    name: {
      type: String,
      required: [true, 'Le nom de l’immobilisation est requis'],
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    cost: {
      type: Number,
      required: [true, 'Le coût d’acquisition est requis'],
      min: [0, 'Le coût ne peut pas être négatif'],
    },
    purchaseDate: {
      type: Date,
      required: [true, 'La date d’acquisition est requise'],
      default: Date.now,
    },
    usefulLifeYears: {
      type: Number,
      required: true,
      min: [1, 'La durée de vie doit être d’au moins 1 an'],
      default: 5,
    },
    salvageValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    method: {
      type: String,
      enum: ['straight_line'],
      default: 'straight_line',
    },
    status: {
      type: String,
      enum: ['active', 'disposed'],
      default: 'active',
      index: true,
    },
    accumulatedDepreciation: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastDepreciationAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

fixedAssetSchema.index({ tenantId: 1, name: 1 });
fixedAssetSchema.index({ tenantId: 1, purchaseDate: -1 });

module.exports = mongoose.model('FixedAsset', fixedAssetSchema);
