const express = require('express');
const { protect, requireTenant, admin } = require('../middlewares/authMiddleware');
const {
  getServices,
  createService,
  updateService,
  deleteService,
} = require('../controllers/serviceController');

const router = express.Router();

router.route('/')
  .get(protect, requireTenant, getServices)
  .post(protect, requireTenant, admin, createService);
router.route('/:id')
  .put(protect, requireTenant, admin, updateService)
  .delete(protect, requireTenant, admin, deleteService);

module.exports = router;
