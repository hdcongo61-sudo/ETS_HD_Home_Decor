const express = require('express');
const {
  getAdminRequests,
  createAdminRequest,
  reviewAdminRequest,
} = require('../controllers/adminRequestController');
const { protect, adminOrPermission } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, getAdminRequests)
  .post(protect, createAdminRequest);

router.put('/:id/review', protect, adminOrPermission('approve_admin_requests'), reviewAdminRequest);

module.exports = router;
