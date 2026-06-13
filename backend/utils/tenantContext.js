const { AsyncLocalStorage } = require('async_hooks');

/**
 * Request-scoped tenant context.
 *
 * authMiddleware.protect runs the rest of each request inside
 * `tenantContext.run({ tenantId, isSuperAdmin, userId }, next)`. Any Mongoose
 * query executed during that request can then read the active tenant from
 * `tenantContext.getStore()` — without threading `req` through every layer.
 *
 * This is what lets the global tenant plugin auto-scope EVERY query
 * (find, findById, count, aggregate, update, delete) so a missed manual
 * filter can never leak another shop's data.
 */
const tenantContext = new AsyncLocalStorage();

const runWithTenant = (store, fn) => tenantContext.run(store, fn);

const getTenantId = () => tenantContext.getStore()?.tenantId || null;

const isSuperAdminContext = () => Boolean(tenantContext.getStore()?.isSuperAdmin);

module.exports = { tenantContext, runWithTenant, getTenantId, isSuperAdminContext };
