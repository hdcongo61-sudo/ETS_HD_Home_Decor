const mongoose = require('mongoose');

/**
 * Membership — rattachement d'un utilisateur à une organisation avec des rôles
 * et un périmètre de boutiques. Compatibilité : `User.tenantId/isAdmin` restent
 * la source legacy jusqu'au cutover (Phase 8).
 */
const membershipSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'removed'],
      default: 'active',
    },
    roleIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Role',
      default: [],
    },
    allLocations: {
      type: Boolean,
      default: true,
    },
    locationIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Location',
      default: [],
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Un utilisateur n'a qu'une appartenance par organisation.
membershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
