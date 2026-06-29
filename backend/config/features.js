// Plan-based feature entitlements ("forfait").
//
// Only features listed in FEATURE_CATALOG are gated — anything not listed is
// available to every plan. This is the versioned code default; a super-admin
// override via PlatformConfig.plans[plan].features can be layered on later.

const FEATURE_KEYS = {
  PROFIT_ANALYSIS: 'profit_analysis',           // "Bénéfices" analytics section in Sales
  PRODUCT_IMPORT: 'product_import',             // Excel product import
  BULK_EDIT: 'bulk_edit',                       // Bulk product modification
  PRODUCT_DUPLICATE: 'product_duplicate',       // Duplicate product records
  DATA_EXPORT: 'data_export',                   // PDF / Excel exports
  PROFORMA: 'proforma',                         // Proforma documents
  DOCUMENTS: 'documents',                       // Company documents module
  EMPLOYEES_PAYROLL: 'employees_payroll',       // Employees & payroll module
  MONTHLY_SPENDING_PLAN: 'monthly_spending_plan', // Expenses monthly objective
  BANK: 'bank',                                 // Caisse / bank module
  SUPPLIER_RESTOCK: 'supplier_restock',         // Supplier restock (deferred)
  LOYALTY: 'loyalty',                           // Client loyalty program
  COMPTABILITE: 'comptabilite',                 // Accounting cockpit (P&L, trésorerie, bilan)
};

// Which plans include each gated feature by default. Trial gets everything so
// shops experience the top tier during the trial; Core / Expenses / WhatsApp
// are available to all plans and are therefore not listed here.
const FEATURE_CATALOG = {
  [FEATURE_KEYS.PROFIT_ANALYSIS]: {
    label: 'Analyse des bénéfices',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.PRODUCT_IMPORT]: {
    label: 'Import Excel des produits',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.BULK_EDIT]: {
    label: 'Modification groupée des produits',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.PRODUCT_DUPLICATE]: {
    label: 'Duplication des produits',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.DATA_EXPORT]: {
    label: 'Export des données (PDF / Excel)',
    plans: ['trial', 'pro', 'enterprise'],
  },
  [FEATURE_KEYS.PROFORMA]: {
    label: 'Factures proforma',
    plans: ['trial', 'pro', 'enterprise'],
  },
  [FEATURE_KEYS.DOCUMENTS]: {
    label: "Documents de l'entreprise",
    plans: ['trial', 'pro', 'enterprise'],
  },
  [FEATURE_KEYS.EMPLOYEES_PAYROLL]: {
    label: 'Employés & paie',
    plans: ['trial', 'pro', 'enterprise'],
  },
  [FEATURE_KEYS.MONTHLY_SPENDING_PLAN]: {
    label: 'Objectif mensuel de dépenses',
    plans: ['trial', 'pro', 'enterprise'],
  },
  [FEATURE_KEYS.BANK]: {
    label: 'Caisse / banque',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.SUPPLIER_RESTOCK]: {
    label: 'Ravitaillement fournisseur',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.LOYALTY]: {
    label: 'Programme de fidélité',
    plans: ['trial', 'enterprise'],
  },
  [FEATURE_KEYS.COMPTABILITE]: {
    label: 'Comptabilité',
    plans: ['trial', 'enterprise'],
  },
};

const ALL_FEATURES = Object.keys(FEATURE_CATALOG);

// The list of gated feature keys a given plan unlocks.
function getDefaultFeaturesForPlan(plan) {
  const key = String(plan || 'trial');
  return ALL_FEATURES.filter((feature) => FEATURE_CATALOG[feature].plans.includes(key));
}

// Effective features for a tenant. No tenant (super-admin / control plane) = all.
function getTenantFeatures(tenant) {
  if (!tenant) return [...ALL_FEATURES];
  return getDefaultFeaturesForPlan(tenant.plan);
}

function tenantHasFeature(tenant, feature) {
  if (!tenant) return true;
  return getTenantFeatures(tenant).includes(feature);
}

// ── DB override (super-admin editable PlatformConfig.plans[plan].features) ──
// Cached briefly to avoid a query on every gated request; invalidated on save.
let _featureMapCache = null;
let _featureMapAt = 0;
const FEATURE_MAP_TTL = 30000;

async function loadPlanFeatureMap() {
  const now = Date.now();
  if (_featureMapCache && now - _featureMapAt < FEATURE_MAP_TTL) return _featureMapCache;
  const PlatformConfig = require('../models/platformConfigModel');
  const cfg = await PlatformConfig.getCatalog();
  const map = {};
  for (const planKey of Object.keys(cfg.plans || {})) {
    map[planKey] = Array.from((cfg.plans[planKey] && cfg.plans[planKey].features) || []);
  }
  _featureMapCache = map;
  _featureMapAt = now;
  return map;
}

function invalidateFeatureCache() {
  _featureMapCache = null;
  _featureMapAt = 0;
}

// Effective gated-feature list for a plan: explicit DB override when non-empty,
// otherwise the versioned code default.
function effectivePlanFeatures(planKey, dbFeatures) {
  const valid = Array.isArray(dbFeatures) ? dbFeatures.filter((f) => ALL_FEATURES.includes(f)) : [];
  return valid.length ? valid : getDefaultFeaturesForPlan(planKey);
}

// Async resolver used at runtime (consults the DB override). No tenant = all.
async function resolveTenantFeatures(tenant) {
  if (!tenant) return [...ALL_FEATURES];
  const planKey = String(tenant.plan || 'trial');
  let features;
  try {
    const map = await loadPlanFeatureMap();
    features = effectivePlanFeatures(planKey, map[planKey]);
  } catch {
    features = getDefaultFeaturesForPlan(planKey);
  }

  // Per-tenant overrides take precedence over the plan.
  const overrides = tenant.featureOverrides && typeof tenant.featureOverrides === 'object'
    ? tenant.featureOverrides
    : null;
  if (overrides) {
    const set = new Set(features);
    ALL_FEATURES.forEach((f) => {
      if (overrides[f] === true) set.add(f);
      else if (overrides[f] === false) set.delete(f);
    });
    features = [...set];
  }
  return features;
}

module.exports = {
  FEATURE_KEYS,
  FEATURE_CATALOG,
  ALL_FEATURES,
  getDefaultFeaturesForPlan,
  getTenantFeatures,
  tenantHasFeature,
  effectivePlanFeatures,
  resolveTenantFeatures,
  invalidateFeatureCache,
};
