const express = require('express');
const {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  applyPromotion,
} = require('../controllers/promotionController');
const { protect, requireTenant, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/apply').post(protect, requireTenant, applyPromotion);
router.route('/')
  .get(protect, requireTenant, admin, getPromotions)
  .post(protect, requireTenant, admin, createPromotion);
router.route('/:id')
  .put(protect, requireTenant, admin, updatePromotion)
  .delete(protect, requireTenant, admin, deletePromotion);

module.exports = router;
