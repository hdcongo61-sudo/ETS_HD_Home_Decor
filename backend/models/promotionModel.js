const mongoose = require('mongoose');

// Promotion (remise / code promo) applicable à une vente.
// Incrément 1 : remise globale sur le sous-total d'une vente (scope 'all').
// Les scopes produit/catégorie sont réservés à un incrément ultérieur.
const promotionSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      required: [true, 'Le code est requis'],
      maxlength: 24,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    type: {
      type: String,
      enum: ['percent', 'amount'],
      default: 'percent',
    },
    value: {
      type: Number,
      required: [true, 'La valeur de la remise est requise'],
      min: [0, 'La valeur ne peut pas être négative'],
    },
    scope: {
      type: String,
      enum: ['all'],
      default: 'all',
    },
    active: {
      type: Boolean,
      default: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    maxUses: {
      type: Number,
      min: 0,
      default: null,
    },
    usesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Code unique par boutique.
promotionSchema.index(
  { tenantId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: { $type: 'objectId' } },
  }
);

module.exports = mongoose.model('Promotion', promotionSchema);
