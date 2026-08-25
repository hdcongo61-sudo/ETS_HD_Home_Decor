const mongoose = require('mongoose');

/**
 * Role — rôle défini au niveau de l'organisation (tenant), système ou custom.
 * Les permissions sont des clés comme 'sales.create', 'inventory.adjust' ou '*'.
 */
const roleSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: [true, 'La clé du rôle est requise'],
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom du rôle est requis'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

roleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
