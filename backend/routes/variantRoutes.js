const express = require('express');
const router = express.Router();
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const {
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} = require('../controllers/variantController');

router
  .route('/')
  .get(protect, requireTenant, getVariants)
  .post(protect, requireTenant, admin, createVariant);

router
  .route('/:id')
  .put(protect, requireTenant, admin, updateVariant)
  .delete(protect, requireTenant, admin, deleteVariant);

module.exports = router;
