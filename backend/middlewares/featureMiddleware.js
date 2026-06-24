const { resolveTenantFeatures, FEATURE_CATALOG } = require('../config/features');

// Route guard: blocks the request when the tenant's plan does not include the
// given feature. Super-admin / control-plane requests (no req.tenant) pass.
const requireFeature = (feature) => async (req, res, next) => {
  try {
    if (!req.tenant) return next();
    const features = await resolveTenantFeatures(req.tenant);
    if (features.includes(feature)) return next();

    return res.status(403).json({
      message: `Cette fonctionnalité (${FEATURE_CATALOG[feature]?.label || feature}) n'est pas incluse dans votre forfait.`,
      code: 'FEATURE_NOT_IN_PLAN',
      feature,
      requiredPlans: FEATURE_CATALOG[feature]?.plans || [],
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { requireFeature };
