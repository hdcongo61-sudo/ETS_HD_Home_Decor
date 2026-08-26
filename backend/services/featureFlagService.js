/**
 * FeatureFlagService — drapeaux de cutover par organisation (Phase 8.2).
 *
 * Les défauts sont conservateurs (v2 désactivée en lecture) ; un tenant
 * pilote peut être basculé indépendamment. L'écriture reste duale tant que
 * les deux sources existent — un flag ne supprime jamais de données.
 */
const FeatureFlag = require('../models/featureFlagModel');

const KNOWN_FLAGS = {
  'catalog.v2': { default: false, label: 'Catalogue v2 (lecture)' },
  'inventory.v2': { default: false, label: 'Inventaire v2 (lecture)' },
  'sales.v2': { default: false, label: 'Ventes/paiements v2 (lecture)' },
  'payments.v2': { default: false, label: 'Paiements v2 (collection dédiée)' },
  'purchasing.v2': { default: false, label: 'Achats v2 (lecture)' },
  'admin.newUi': { default: false, label: 'Nouvelle interface d\'administration' },
};

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

async function getFlags({ tenantId }) {
  const rows = await FeatureFlag.find({ tenantId }).lean();
  const resolved = {};
  for (const [key, meta] of Object.entries(KNOWN_FLAGS)) {
    resolved[key] = meta.default;
  }
  for (const row of rows) {
    if (KNOWN_FLAGS[row.key]) resolved[row.key] = row.value;
  }
  return { tenantId, flags: resolved, defaults: KNOWN_FLAGS };
}

async function setFlag({ tenantId, key, value, userId = null }) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!KNOWN_FLAGS[normalized]) throw notFound(`Drapeau inconnu : ${normalized}.`);
  if (typeof value !== 'boolean') throw badRequest('La valeur doit être un booléen.');
  return FeatureFlag.findOneAndUpdate(
    { tenantId, key: normalized },
    { $set: { value, updatedBy: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = { getFlags, setFlag, KNOWN_FLAGS };
