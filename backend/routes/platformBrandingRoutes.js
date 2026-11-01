const express = require('express');
const { protect, superAdmin } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');
const {
  getPlatformBranding,
  updatePlatformBranding,
} = require('../controllers/platformBrandingController');

const router = express.Router();

router.get('/public', getPlatformBranding);
router.put('/', protect, superAdmin, imageUpload.single('logoFile'), updatePlatformBranding);

module.exports = router;
