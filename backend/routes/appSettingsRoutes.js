const express = require('express');
const {
  getPublicAppSettings,
  updateAppSettings,
} = require('../controllers/appSettingsController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// Public (login page) — returns global branding when unauthenticated.
router.get('/public', getPublicAppSettings);
// Authenticated — returns THIS tenant's settings (req.tenantId set by protect).
router.get('/', protect, getPublicAppSettings);
router.put('/', protect, admin, imageUpload.single('logoFile'), updateAppSettings);

module.exports = router;
