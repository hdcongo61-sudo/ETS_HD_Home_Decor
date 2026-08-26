const mongoose = require('mongoose');

/**
 * ImportJob — import en étapes (Phase 7.8).
 *
 *   uploaded → validated (aperçu + erreurs par ligne)
 *   validated → confirmed → running → completed / failed
 *
 * Exécution par lots bornés avec points de contrôle ; le SKU sert d'identifiant
 * externe pour l'idempotence (les lignes déjà présentes sont comptées `skipped`).
 */
const previewRowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    errors: { type: [{ field: String, message: String }], default: [] },
    status: { type: String, enum: ['valid', 'invalid', 'created', 'skipped', 'failed'], default: 'valid' },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const importJobSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['products'], required: true },
    fileName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['uploaded', 'validated', 'confirmed', 'running', 'completed', 'failed', 'cancelled'],
      default: 'uploaded',
      index: true,
    },
    rows: { type: [previewRowSchema], default: [] },
    stats: {
      total: { type: Number, default: 0 },
      valid: { type: Number, default: 0 },
      invalid: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    batchSize: { type: Number, default: 50 },
    checkpointProcessed: { type: Number, default: 0 },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

importJobSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ImportJob', importJobSchema);
