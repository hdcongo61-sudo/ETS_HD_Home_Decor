const express = require('express');
const {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  postDepreciation,
} = require('../controllers/fixedAssetController');
const { protect, requireTenant, admin, resolveLocation } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, requireTenant, getAssets)
  .post(protect, requireTenant, admin, resolveLocation, createAsset);

router.post('/:id/depreciate', protect, requireTenant, admin, postDepreciation);

router.route('/:id')
  .get(protect, requireTenant, getAssetById)
  .put(protect, requireTenant, admin, updateAsset)
  .delete(protect, requireTenant, admin, deleteAsset);

module.exports = router;
