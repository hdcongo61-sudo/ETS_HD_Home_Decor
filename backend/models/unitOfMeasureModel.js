const mongoose = require('mongoose');

/**
 * UnitOfMeasure — unité de mesure du catalogue (Phase 3.3).
 * ex. pièce, carton, mètre, kilogramme, litre, paquet.
 */
const unitClassEnum = ['count', 'length', 'weight', 'volume', 'area', 'other'];

const unitOfMeasureSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: [true, 'La clé de l’unité est requise'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_-]{2,32}$/, 'Clé invalide (lettres minuscules, chiffres, - et _)'],
    },
    name: {
      type: String,
      required: [true, 'Le nom de l’unité est requis'],
      trim: true,
    },
    symbol: {
      type: String,
      trim: true,
      default: '',
    },
    unitClass: {
      type: String,
      enum: unitClassEnum,
      default: 'other',
    },
    // Précision décimale autorisée pour les quantités exprimées dans cette unité.
    decimals: {
      type: Number,
      min: 0,
      max: 4,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

unitOfMeasureSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('UnitOfMeasure', unitOfMeasureSchema);
