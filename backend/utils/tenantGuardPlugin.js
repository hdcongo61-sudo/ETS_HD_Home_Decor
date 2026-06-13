const { getTenantId } = require('./tenantContext');

/**
 * Global Mongoose plugin: automatic tenant scoping (fail-closed).
 *
 * Applied to every schema that has a `tenantId` path. For each request that
 * runs inside a tenant context (see tenantContext.js), it injects
 * `{ tenantId }` into:
 *   - all find / findOne / findById / count / countDocuments queries
 *   - all update / delete / findOneAndUpdate / findOneAndDelete queries
 *   - aggregate pipelines (as a leading $match)
 *   - new documents on save
 *
 * Models WITHOUT a tenantId path (e.g. Tenant) are never touched, so
 * super-admin control-plane queries and the auth bootstrap keep working.
 *
 * Safety rules:
 *   - If there is no tenant context (super-admin control plane, scripts,
 *     migrations, the pre-context auth lookup), nothing is injected.
 *   - If the caller already set `tenantId` on the query, it is respected.
 */
module.exports = function tenantGuardPlugin(schema) {
  // Only guard models that actually carry a tenantId.
  if (!schema.path('tenantId')) return;

  const QUERY_HOOKS = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
    'findOneAndReplace', 'count', 'countDocuments',
    'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne',
  ];

  QUERY_HOOKS.forEach((op) => {
    schema.pre(op, function injectTenant() {
      // Explicit opt-out (e.g. resolving a trusted cross-tenant reference such
      // as the seller of a sale, who may be a super-admin with no tenantId).
      if (this.getOptions && this.getOptions().skipTenantGuard) return;

      const tenantId = getTenantId();
      if (!tenantId) return; // no context → no injection (super-admin / scripts)

      const q = this.getQuery();
      // Respect an explicit tenantId already set by the caller.
      if (q.tenantId === undefined) {
        this.where({ tenantId });
      }
    });
  });

  // Aggregations: prepend a $match on tenantId.
  schema.pre('aggregate', function injectTenantAggregate() {
    const tenantId = getTenantId();
    if (!tenantId) return;

    const pipeline = this.pipeline();
    const first = pipeline[0];
    // Avoid double-scoping if a leading $match already filters tenantId.
    const alreadyScoped =
      first && first.$match && Object.prototype.hasOwnProperty.call(first.$match, 'tenantId');
    if (!alreadyScoped) {
      pipeline.unshift({ $match: { tenantId } });
    }
  });

  // New documents: stamp tenantId from context if not already set.
  schema.pre('save', function stampTenant(next) {
    if (this.isNew && !this.tenantId) {
      const tenantId = getTenantId();
      if (tenantId) this.tenantId = tenantId;
    }
    next();
  });
};
