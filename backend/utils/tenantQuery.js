const mongoose = require('mongoose');

/**
 * A filter that matches NOTHING. Used to fail closed: when there is no
 * tenant context on a data-plane request, the user must see zero rows
 * rather than every tenant's rows.
 */
const matchNothing = () => ({ _id: new mongoose.Types.ObjectId() });

/**
 * tenantFilter(req)
 * Returns a MongoDB filter that scopes a query to the current tenant.
 *
 * SECURITY: this fails CLOSED. If there is no `req.tenantId` on the
 * request (e.g. a super-admin who has not impersonated, or a token that
 * somehow lacks a tenant), the query matches nothing instead of
 * everything. Cross-tenant reads are only possible through the dedicated
 * /api/tenants controllers, which query the models directly.
 */
const tenantFilter = (req) => {
  if (req.tenantId) return { tenantId: req.tenantId };
  return matchNothing();
};

/**
 * applyTenant(req, data)
 * Stamps the current tenantId onto a document payload before create/save.
 *
 * SECURITY: this fails CLOSED. If there is no tenant context, it throws
 * rather than creating an orphaned (tenant-less) document that could leak
 * into another shop's view.
 */
const applyTenant = (req, data = {}) => {
  if (!req.tenantId) {
    const err = new Error("Aucune boutique active. Cette action nécessite un contexte boutique.");
    err.statusCode = 400;
    throw err;
  }
  // tenantId is forced last so a caller can never override it from the body
  return { ...data, tenantId: req.tenantId };
};

module.exports = { tenantFilter, applyTenant, matchNothing };
