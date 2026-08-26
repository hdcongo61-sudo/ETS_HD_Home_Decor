const mongoose = require('mongoose');

/**
 * CutoverReport — rapport de réconciliation final archivé (Phase 8.7).
 *
 * Un instantané signé (checksum SHA-256) par organisation : comptages par
 * collection, stocks, ventes, paiements, retours, achats, orphelins,
 * doublons, version de migration et horodatage.
 */
const cutoverReportSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    migrationVersion: { type: Number, default: 1 },
    softwareRevision: { type: String, default: '' },
    report: { type: mongoose.Schema.Types.Mixed, required: true },
    checksum: { type: String, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

cutoverReportSchema.index({ tenantId: 1, generatedAt: -1 });

module.exports = mongoose.model('CutoverReport', cutoverReportSchema);
