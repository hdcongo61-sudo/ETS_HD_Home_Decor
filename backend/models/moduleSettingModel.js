const mongoose = require('mongoose');

/**
 * ModuleSetting — remplacement de module par organisation (Phase 7.2).
 *
 * Peut forcer l'activation/désactivation d'un module (dans la limite des
 * droits de plan : l'entitlement backend reste autoritaire) et stocker une
 * configuration validée contre le schéma du module.
 */
const moduleSettingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    enabled: { type: Boolean, default: true },
    config: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

moduleSettingSchema.index({ tenantId: 1, moduleKey: 1 }, { unique: true });

module.exports = mongoose.model('ModuleSetting', moduleSettingSchema);
