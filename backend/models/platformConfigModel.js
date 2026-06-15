const mongoose = require('mongoose');

/**
 * Platform-level configuration (singleton). Holds the editable plan catalog
 * so a super-admin can change prices and limits without a code deploy.
 *
 * No `tenantId` path → exempt from the tenant guard plugin (control plane).
 */
const planSchema = new mongoose.Schema(
  {
    label:       { type: String, default: '' },
    price:       { type: Number, default: 0, min: 0 },   // CFA / month
    maxUsers:    { type: Number, default: 3, min: 1 },
    maxProducts: { type: Number, default: 500, min: 1 },
    features:    { type: [String], default: [] },
  },
  { _id: false }
);

const platformConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true },
    plans: {
      trial:      { type: planSchema, default: () => ({}) },
      basic:      { type: planSchema, default: () => ({}) },
      pro:        { type: planSchema, default: () => ({}) },
      enterprise: { type: planSchema, default: () => ({}) },
    },
    // Editable document overrides (flyer / guide / formation). When a key is
    // present it replaces the hardcoded default from docContent.js. Shape:
    // { [type]: { title, subtitle, sections: [{ heading, body, bullets: [] }] } }
    docs: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const PlatformConfig = mongoose.model('PlatformConfig', platformConfigSchema);

/**
 * Returns the singleton config, seeding it from the hardcoded PLAN_CATALOG
 * defaults the first time. Always returns a plain object's `plans`.
 */
PlatformConfig.getCatalog = async function getCatalog() {
  const { PLAN_CATALOG } = require('./tenantModel');
  let cfg = await PlatformConfig.findOne({ singleton: 'main' });
  if (!cfg) {
    cfg = await PlatformConfig.create({ singleton: 'main', plans: PLAN_CATALOG });
  }
  return cfg;
};

module.exports = PlatformConfig;
