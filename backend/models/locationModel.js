const mongoose = require('mongoose');

/**
 * Location — boutique, entrepôt, bureau ou zone de transit d'une organisation.
 *
 * Phase 2 : le `Tenant` reste l'identifiant de l'organisation abonnée ; la
 * Location est l'emplacement opérationnel. Chaque tenant existant reçoit une
 * Location par défaut « Boutique principale » (scripts/backfillLocations.js).
 */
const locationSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Le code de la boutique est requis'],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom de la boutique est requis'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['store', 'warehouse', 'office', 'transit'],
      default: 'store',
    },
    address: {
      type: String,
      default: '',
    },
    isSalesLocation: {
      type: Boolean,
      default: true,
    },
    isStockLocation: {
      type: Boolean,
      default: true,
    },
    isActive: {
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

// Unicité par organisation (code et nom), jamais globale.
locationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
locationSchema.index({ tenantId: 1, name: 1 }, { unique: true });
locationSchema.index({ tenantId: 1, type: 1, isActive: 1 });

module.exports = mongoose.model('Location', locationSchema);
