const express = require('express');
const {
  getPublicAppSettings,
  updateAppSettings,
} = require('../controllers/appSettingsController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// Public (login page) — returns global branding when unauthenticated.
router.get('/public', getPublicAppSettings);
// Authenticated — returns THIS tenant's settings (req.tenantId set by protect).
router.get('/', protect, requireTenant, getPublicAppSettings);
router.put('/', protect, requireTenant, admin, imageUpload.single('logoFile'), updateAppSettings);

module.exports = router;
