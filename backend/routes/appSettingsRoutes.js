const express = require('express');
const {
  getPublicAppSettings,
  updateAppSettings,
} = require('../controllers/appSettingsController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.get('/public', getPublicAppSettings);
router.put('/', protect, admin, imageUpload.single('logoFile'), updateAppSettings);

module.exports = router;
