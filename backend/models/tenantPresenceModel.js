const mongoose = require('mongoose');

const tenantPresenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
    },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

tenantPresenceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('TenantPresence', tenantPresenceSchema);
