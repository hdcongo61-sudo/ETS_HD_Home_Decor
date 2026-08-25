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
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const { requireFeature } = require('../middlewares/featureMiddleware');
const { FEATURE_KEYS } = require('../config/features');
const { route } = require('./productRoutes');

router.route('/stats').get(protect, requireTenant, admin, getClientStats);
router.route('/filter').get(protect, requireTenant, admin, getFilteredClients);
router.route('/loyalty').get(protect, requireTenant, admin, requireFeature(FEATURE_KEYS.LOYALTY), getLoyaltyOverview);

router.route('/')
  .get(protect, requireTenant, getClients)
  .post(protect, requireTenant, createClient);

router.route('/:id/loyalty').post(protect, requireTenant, admin, requireFeature(FEATURE_KEYS.LOYALTY), adjustLoyaltyPoints);

router.route('/:id')
  .get(protect, requireTenant, getClientById)
  .put(protect, requireTenant, admin, updateClient)
  .delete(protect, requireTenant, admin, deleteClient);

module.exports = router;
