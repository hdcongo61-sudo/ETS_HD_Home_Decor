/**
 * moduleController — catalogue de modules et paramètres (Phases 7.2-7.3).
 */
const asyncHandler = require('express-async-handler');
const moduleService = require('../services/moduleService');
const settingsService = require('../services/settingsService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   GET /api/v2/modules
const getModules = asyncRoute(async (req, res) => {
  const modules = await moduleService.resolveModules({
    tenantId: req.tenantId,
    userId: req.user ? req.user._id : null,
  });
  res.json({ modules, generatedAt: new Date() });
});

// @route   PUT /api/v2/modules/:key/settings
const setModuleSetting = asyncRoute(async (req, res) => {
  const setting = await moduleService.setModuleSetting({
    tenantId: req.tenantId,
    moduleKey: String(req.params.key).toLowerCase(),
    data: req.body,
    userId: req.user ? req.user._id : null,
  });
  res.json(setting);
});

// @route   GET /api/v2/settings
const getSettings = asyncRoute(async (req, res) => {
  const settings = await settingsService.getSettings({
    tenantId: req.tenantId,
    locationId: req.locationId || req.query.locationId || null,
  });
  res.json({ settings, generatedAt: new Date() });
});

// @route   PUT /api/v2/settings
const setSettings = asyncRoute(async (req, res) => {
  const values = req.body.values || {};
  if (typeof values !== 'object' || Array.isArray(values)) {
    return res.status(400).json({ message: 'Un objet values { cle: valeur } est requis.' });
  }
  const locationId = Object.prototype.hasOwnProperty.call(req.body, 'locationId')
    ? (req.body.locationId || null)
    : (req.locationId || null);
  for (const [key, value] of Object.entries(values)) {
    await settingsService.setSetting({
      tenantId: req.tenantId, locationId, key, value,
      userId: req.user ? req.user._id : null,
    });
  }
  const settings = await settingsService.getSettings({ tenantId: req.tenantId, locationId });
  res.json({ settings });
});

// @route   DELETE /api/v2/settings/:key
const resetSetting = asyncRoute(async (req, res) => {
  const result = await settingsService.resetSetting({
    tenantId: req.tenantId,
    locationId: req.locationId || null,
    key: req.params.key,
  });
  res.json(result);
});

module.exports = { getModules, setModuleSetting, getSettings, setSettings, resetSetting };
