const express = require('express');
const {
  getAdminRequests,
  createAdminRequest,
  reviewAdminRequest,
} = require('../controllers/adminRequestController');
const { protect, adminOrPermission, requireTenant } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, requireTenant, getAdminRequests)
  .post(protect, requireTenant, createAdminRequest);

router.put('/:id/review', protect, requireTenant, adminOrPermission('approve_admin_requests'), reviewAdminRequest);

module.exports = router;
