const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
  getFilteredClients
} = require('../controllers/clientController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { route } = require('./productRoutes');

router.route('/stats').get(protect, admin, getClientStats);
router.route('/filter').get(protect, admin, getFilteredClients);

router.route('/')
  .get(protect, getClients)
  .post(protect, createClient);

router.route('/:id')
  .get(protect, getClientById)
  .put(protect, admin, updateClient)
  .delete(protect, admin, deleteClient);

module.exports = router;
