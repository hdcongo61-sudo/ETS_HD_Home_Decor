const mongoose = require('mongoose');

/**
 * SettingOverride — hiérarchie des paramètres (Phase 7.3).
 *
 * Ordre de résolution :
 *   défaut plateforme → droit de plan → organisation → remplacement boutique.
 *
 * Un document = une clé remplacée à un niveau (organisation : locationId null,
 * ou boutique : locationId renseigné).
 */
const settingOverrideSchema = new mongoose.Schema(
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
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

settingOverrideSchema.index({ tenantId: 1, locationId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('SettingOverride', settingOverrideSchema);
