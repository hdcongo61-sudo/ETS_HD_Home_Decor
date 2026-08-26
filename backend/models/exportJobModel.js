const mongoose = require('mongoose');

/**
 * ExportJob — export asynchrone (Phase 7.7).
 *
 * Enregistre le tenant, le demandeur, un instantané des permissions, les
 * filtres, le statut, la progression, l'actif produit, l'expiration et
 * l'erreur éventuelle. Le téléchargement est signé par un jeton expirant.
 */
const exportJobSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['sales', 'inventory'],
      required: true,
    },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    permissionsSnapshot: { type: [String], default: [] },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    result: {
      fileName: { type: String, default: '' },
      contentType: { type: String, default: 'text/csv' },
      downloadToken: { type: String, default: null },
      rows: { type: Number, default: 0 },
    },
    expiresAt: { type: Date, default: null },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

exportJobSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('ExportJob', exportJobSchema);
