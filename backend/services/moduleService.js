/**
 * ModuleService — résolution du catalogue de modules (Phase 7.2).
 *
 * `resolveModules` combine :
 *   1. droit de plan (featureKey → FEATURE_CATALOG) ;
 *   2. remplacement organisationnel (ModuleSetting) ;
 *   3. permission de l'utilisateur (autorisation backend, décisionnaire).
 */
const { MODULE_CATALOG } = require('../config/modules');
const { FEATURE_CATALOG } = require('../config/features');
const ModuleSetting = require('../models/moduleSettingModel');
const Tenant = require('../models/tenantModel');
const { getUserPermissions } = require('./authorization');

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const isEntitled = (module, plan) => {
  if (!module.featureKey) return true;
  const entry = FEATURE_CATALOG[module.featureKey];
  if (!entry) return true; // non gaté → disponible
  return (entry.plans || []).includes(plan);
};

async function resolveModules({ tenantId, userId = null }) {
  const tenant = await Tenant.findById(tenantId).select('plan').lean();
  const plan = tenant ? tenant.plan : 'trial';
  const overrides = await ModuleSetting.find({ tenantId }).lean();
  const overrideMap = new Map(overrides.map((override) => [override.moduleKey, override]));

  const { permissions } = await getUserPermissions(tenantId, userId);
  const canAll = permissions.includes('*');

  return MODULE_CATALOG.map((module) => {
    const entitled = isEntitled(module, plan);
    const override = overrideMap.get(module.key);
    const enabled = entitled && (override ? override.enabled !== false : true);
    const allowed = enabled && (canAll || permissions.includes(module.permission));
    return {
      key: module.key,
      label: module.label,
      version: module.version,
      routes: module.routes,
      permission: module.permission,
      nav: module.nav,
      configSchema: module.configSchema,
      entitled,
      enabled,
      allowed,
      override: override
        ? { enabled: override.enabled, config: override.config }
        : null,
    };
  });
}

async function setModuleSetting({ tenantId, moduleKey, data, userId = null }) {
  const module = MODULE_CATALOG.find((entry) => entry.key === moduleKey);
  if (!module) throw notFound('Module inconnu.');

  const update = { updatedBy: userId };
  if (data.enabled !== undefined) update.enabled = Boolean(data.enabled);
  if (data.config !== undefined) {
    if (module.configSchema && module.configSchema.properties
      && (typeof data.config !== 'object' || data.config === null)) {
      throw badRequest('La configuration doit être un objet conforme au schéma du module.');
    }
    update.config = data.config;
  }
  if (!('enabled' in update) && !('config' in update)) throw badRequest('Aucune valeur à enregistrer.');

  return ModuleSetting.findOneAndUpdate(
    { tenantId, moduleKey },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = { resolveModules, setModuleSetting, MODULE_CATALOG };
