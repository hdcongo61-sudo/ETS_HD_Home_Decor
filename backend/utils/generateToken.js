const jwt = require('jsonwebtoken');

/**
 * Génère un JWT d'authentification.
 * opts: { tokenVersion, impersonatedBy, impersonationReason, expiresIn }
 */
const generateToken = (id, tenantId = null, opts = {}) => {
  const payload = { id };
  if (tenantId) payload.tenantId = tenantId.toString();
  if (opts.tokenVersion !== undefined && opts.tokenVersion !== null) payload.ver = opts.tokenVersion;
  if (opts.impersonatedBy) payload.impersonatedBy = opts.impersonatedBy;
  if (opts.impersonationReason) payload.impersonationReason = opts.impersonationReason;
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: opts.expiresIn || process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;
