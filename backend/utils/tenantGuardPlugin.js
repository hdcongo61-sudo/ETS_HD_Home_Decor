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
 *   - If the caller sets `tenantId` equal to the active context, it is kept.
 *   - If the caller sets a DIFFERENT `tenantId`, the operation is rejected
 *     (fail-closed) — prevents cross-tenant pollution in data-plane code.
 */
module.exports = function tenantGuardPlugin(schema) {
  // Only guard models that actually carry a tenantId.
  if (!schema.path('tenantId')) return;

  // Marker used by the startup assertion in server.js.
  schema.tenantGuardVersion = 1;

  const assertTenantMatch = (givenTenantId) => {
    const tenantId = getTenantId();
    if (!tenantId) return true; // pas de contexte → pas de vérification
    const given = givenTenantId && givenTenantId.toString ? givenTenantId.toString() : null;
    if (!given || given !== String(tenantId)) {
      const err = new Error('TENANT_GUARD: opération ciblant un tenantId différent du contexte actif.');
      err.tenantGuardViolation = true;
      throw err;
    }
    return true;
  };

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
      // Fail-closed : un tenantId explicite doit correspondre au contexte actif.
      if (q && q.tenantId !== undefined) {
        assertTenantMatch(q.tenantId);
        return;
      }
      this.where({ tenantId });
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
    if (alreadyScoped) {
      assertTenantMatch(first.$match.tenantId);
      return;
    }
    pipeline.unshift({ $match: { tenantId } });
  });

  // New documents: stamp tenantId from context if not already set.
  schema.pre('save', function stampTenant(next) {
    if (this.isNew) {
      const tenantId = getTenantId();
      if (tenantId) {
        if (!this.tenantId) {
          this.tenantId = tenantId;
        } else {
          // Fail-closed : un document neuf déjà rattaché à un autre tenant est rejeté.
          const given = this.tenantId && this.tenantId.toString ? this.tenantId.toString() : null;
          if (given !== String(tenantId)) {
            const err = new Error('TENANT_GUARD: création de document avec un tenantId différent du contexte actif.');
            err.tenantGuardViolation = true;
            return next(err);
          }
        }
      }
    }
    next();
  });
};
