// Tenant tax (TVA) helpers. Tax is configured per shop in AppSettings.tax and
// snapshotted on each sale so later rate edits never change past invoices.

const AppSettings = require('../models/appSettingsModel');

const DEFAULT_TAX = { enabled: false, rate: 0, label: 'TVA', inclusive: true };

const normalizeTax = (tax = {}) => {
  const rate = Number(tax.rate);
  return {
    enabled: Boolean(tax.enabled),
    rate: Number.isFinite(rate) && rate > 0 ? Math.min(100, rate) : 0,
    label: typeof tax.label === 'string' && tax.label.trim()
      ? tax.label.trim().slice(0, 20)
      : 'TVA',
    inclusive: tax.inclusive !== false,
  };
};

// Effective tax config for a tenant (legacy single-shop uses tenantId null).
const getTenantTax = async (tenantId) => {
  try {
    const settings = await AppSettings.findOne(tenantId ? { tenantId } : { tenantId: null })
      .select('tax')
      .lean();
    return normalizeTax(settings?.tax);
  } catch {
    return { ...DEFAULT_TAX };
  }
};

// Inclusive VAT: the sale total already contains the tax.
const computeTaxFromTotal = (totalAmount, tax) => {
  const config = normalizeTax(tax);
  if (!config.enabled || config.rate <= 0) return 0;
  return Math.round((Number(totalAmount) || 0) * config.rate / (100 + config.rate));
};

module.exports = { DEFAULT_TAX, normalizeTax, getTenantTax, computeTaxFromTotal };
