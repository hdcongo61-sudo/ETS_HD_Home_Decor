const mongoose = require('mongoose');

/**
 * Platform-level audit log of super-admin actions across tenants.
 *
 * Deliberately has NO `tenantId` path so the global tenant guard plugin
 * leaves it un-scoped — it is a control-plane log, queried only by
 * super-admins. The affected tenant is stored as `targetTenant` instead.
 */
const platformAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      // tenant.create, tenant.suspend, tenant.reactivate, tenant.plan_change,
      // tenant.update, tenant.delete, tenant.impersonate, tenant.payment
      index: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    targetTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    targetTenantName: { type: String, default: '' },
    // Free-form details: { from, to, amount, reason, ... }
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

const PlatformAudit = mongoose.model('PlatformAudit', platformAuditSchema);

/**
 * Fire-and-forget audit writer. Never throws into the request path.
 */
PlatformAudit.record = function record({ req, action, tenant, meta }) {
  try {
    return PlatformAudit.create({
      action,
      actor: req?.user?._id || null,
      actorName: req?.user?.name || '',
      targetTenant: tenant?._id || tenant?.id || null,
      targetTenantName: tenant?.name || '',
      meta: meta || {},
      ip: req?.ip || '',
    }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
};

module.exports = PlatformAudit;
