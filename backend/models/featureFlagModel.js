const mongoose = require('mongoose');

/**
 * FeatureFlag — drapeau de bascule par organisation (Phase 8.2).
 *
 * Contrôle indépendamment : catalog.v2, inventory.v2, sales.v2,
 * payments.v2, purchasing.v2, admin.newUi. Les valeurs par défaut viennent
 * du code (voir services/featureFlagService) ; un flag ne change jamais de
 * données : il oriente uniquement les lectures/écritures.
 */
const featureFlagSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

featureFlagSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);
