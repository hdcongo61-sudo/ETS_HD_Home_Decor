const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const { getModules, setModuleSetting, getSettings, setSettings, resetSetting } = require('../controllers/moduleController');

// Catalogue de modules (Phase 7.2).
router.get('/modules', protect, requireTenant, getModules);
router.put('/modules/:key/settings', protect, requireTenant, requirePermission('organization.manage'), setModuleSetting);

// Paramètres hiérarchisés (Phase 7.3).
router.get('/settings', protect, requireTenant, resolveLocation, getSettings);
router.put('/settings', protect, requireTenant, resolveLocation, requirePermission('organization.manage'), setSettings);
router.delete('/settings/:key', protect, requireTenant, resolveLocation, requirePermission('organization.manage'), resetSetting);

module.exports = router;
