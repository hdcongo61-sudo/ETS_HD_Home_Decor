const express = require('express');
const router = express.Router();
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} = require('../controllers/locationController');

router
  .route('/')
  .get(protect, requireTenant, getLocations)
  .post(protect, requireTenant, admin, createLocation);

router
  .route('/:id')
  .put(protect, requireTenant, admin, updateLocation)
  .delete(protect, requireTenant, admin, deleteLocation);

module.exports = router;
