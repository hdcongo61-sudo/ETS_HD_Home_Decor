const crypto = require('crypto');

/**
 * Observabilité de base (Phase 1) :
 *   - attribue un requestId (ou propage l'en-tête X-Request-Id),
 *   - l'expose en en-tête de réponse,
 *   - journalise une ligne JSON structurée par requête (méthode, chemin, statut,
 *     durée, tenant, utilisateur) SANS données sensibles.
 */

const requestIdMiddleware = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && /^[\w-]{1,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

const requestLoggerMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const entry = {
      ts: new Date().toISOString(),
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      tenantId: req.tenantId ? String(req.tenantId) : null,
      locationId: req.locationId ? String(req.locationId) : null,
      userId: req.user ? String(req.user._id) : req.platformUser ? String(req.platformUser._id) : null,
      isImpersonating: Boolean(req.isImpersonating),
    };
    console.log(JSON.stringify(entry));
  });
  next();
};

module.exports = { requestIdMiddleware, requestLoggerMiddleware };
