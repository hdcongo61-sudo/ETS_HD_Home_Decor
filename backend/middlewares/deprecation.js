/**
 * DeprecationMiddleware — en-têtes et journalisation de dépréciation
 * (Phase 8.5).
 *
 * Pose `Deprecation`, `Deprecation-Since`, `Sunset` et `Link:
 * <replacement>; rel="successor-version"` sur les réponses des routes
 * legacy, et journalise une fois par chemin (pas de spam).
 */
const loggedPaths = new Set();

const deprecate = ({ since, sunset, replacement, note = '' }) => (req, res, next) => {
  res.set('Deprecation', 'true');
  if (since) res.set('Deprecation-Since', since);
  if (sunset) res.set('Sunset', sunset);
  if (replacement) res.set('Link', `<${replacement}>; rel="successor-version"`);
  req.deprecationInfo = { since, sunset, replacement, note };

  const key = `${req.method} ${req.originalUrl || req.url}`;
  if (!loggedPaths.has(key)) {
    loggedPaths.add(key);
    console.warn(`[DEPRECATED] ${key} → ${replacement || '—'} (sunset ${sunset || 'non défini'})`);
  }
  next();
};

module.exports = { deprecate };
