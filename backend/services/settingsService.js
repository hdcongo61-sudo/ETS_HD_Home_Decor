/**
 * SettingsService — hiérarchie des paramètres (Phase 7.3).
 *
 * Ordre de résolution :
 *   défaut plateforme → remplacement organisation → remplacement boutique.
 *
 * Les clés sont versionnées ici (schéma par défaut) ; un remplacement se
 * limite aux clés connues et au type attendu.
 */
const SettingOverride = require('../models/settingOverrideModel');

const PLATFORM_DEFAULTS = {
  currency: 'XOF',
  locale: 'fr-FR',
  timezone: 'Africa/Dakar',
  'numbering.fiscalPeriod': 'year',
  'inventory.policy': 'weighted_average',
  'payments.allowCredit': false,
  'returns.maxReturnDays': 30,
  'approvals.poSeparation': true,
  'notifications.saleCreated': true,
};

const SETTING_KEYS = new Set(Object.keys(PLATFORM_DEFAULTS));

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

async function getSettings({ tenantId, locationId = null }) {
  const overrides = await SettingOverride.find({
    tenantId,
    locationId: { $in: [null, locationId] },
  }).lean();
  const org = new Map();
  const location = new Map();
  for (const override of overrides) {
    (override.locationId ? location : org).set(override.key, override.value);
  }

  const resolved = { ...PLATFORM_DEFAULTS };
  for (const [key, value] of org) resolved[key] = value;
  for (const [key, value] of location) resolved[key] = value;
  return resolved;
}

async function setSetting({ tenantId, locationId = null, key, value, userId = null }) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!SETTING_KEYS.has(normalized)) {
    throw badRequest(`Clé de paramètre inconnue : ${normalized}.`);
  }
  const expectedType = typeof PLATFORM_DEFAULTS[normalized];
  if (typeof value !== expectedType) {
    throw badRequest(`Type invalide pour ${normalized} (attendu : ${expectedType}).`);
  }
  if (expectedType === 'string' && !String(value).trim()) {
    throw badRequest(`Valeur vide interdite pour ${normalized}.`);
  }

  return SettingOverride.findOneAndUpdate(
    { tenantId, locationId, key: normalized },
    { $set: { value, updatedBy: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function resetSetting({ tenantId, locationId = null, key }) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!SETTING_KEYS.has(normalized)) throw badRequest(`Clé de paramètre inconnue : ${normalized}.`);
  const result = await SettingOverride.deleteOne({ tenantId, locationId, key: normalized });
  return { reset: result.deletedCount > 0 };
}

module.exports = { getSettings, setSetting, resetSetting, PLATFORM_DEFAULTS, SETTING_KEYS };
