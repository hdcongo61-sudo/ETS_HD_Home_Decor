const mongoose = require('mongoose');

/**
 * UserSession — session de connexion (Phase 0.8).
 *
 * Suivi par appareil : device, IP, user-agent, tokenVersion au moment de
 * l'émission, dernière activité et expiration. La révocation globale
 * incrémente `tokenVersion` du principal — les anciens jetons meurent.
 */
const userSessionSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['user', 'platform'],
      default: 'user',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    device: { type: String, trim: true, default: '' },
    ip: { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
    tokenVersion: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      index: true,
    },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSessionSchema.index({ kind: 1, userId: 1, status: 1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
