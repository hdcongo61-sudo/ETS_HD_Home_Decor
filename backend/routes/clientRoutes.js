const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
  getFilteredClients,
  getLoyaltyOverview,
  adjustLoyaltyPoints
} = require('../controllers/clientController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { requireFeature } = require('../middlewares/featureMiddleware');
const { FEATURE_KEYS } = require('../config/features');
const { route } = require('./productRoutes');

router.route('/stats').get(protect, admin, getClientStats);
router.route('/filter').get(protect, admin, getFilteredClients);
router.route('/loyalty').get(protect, admin, requireFeature(FEATURE_KEYS.LOYALTY), getLoyaltyOverview);

router.route('/')
  .get(protect, getClients)
  .post(protect, createClient);

router.route('/:id/loyalty').post(protect, admin, requireFeature(FEATURE_KEYS.LOYALTY), adjustLoyaltyPoints);

router.route('/:id')
  .get(protect, getClientById)
  .put(protect, admin, updateClient)
  .delete(protect, admin, deleteClient);

module.exports = router;
