const mongoose = require('mongoose');

/**
 * UnitConversion — équivalence entre unités (globale ou propre à un produit).
 * ex. 1 carton = 24 pièces : fromUnitId=carton, toUnitId=piece, factor=24.
 * Le facteur est stocké en Number > 0 ; les calculs en unité de base seront
 * faits avec une précision contrôlée par l'unité (inventaire v2).
 */
const unitConversionSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    fromUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitOfMeasure',
      required: true,
    },
    toUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitOfMeasure',
      required: true,
    },
    factor: {
      type: Number,
      required: [true, 'Le facteur de conversion est requis'],
    },
    // null = conversion globale ; sinon spécifique à ce produit.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
  },
  { timestamps: true }
);

// Une seule conversion par sens, par produit (productId null = globale).
// Index unique simple (sans partiel) : MongoDB n'autorise pas deux index
// partiels sur la même clé.
unitConversionSchema.index(
  { tenantId: 1, fromUnitId: 1, toUnitId: 1, productId: 1 },
  { unique: true }
);

module.exports = mongoose.model('UnitConversion', unitConversionSchema);
