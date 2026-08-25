const express = require('express');
const router = express.Router();
const {
  getPublicKey,
  sendWeeklyReportReminder,
  subscribe,
  unsubscribe
} = require('../controllers/notificationController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');

router.get('/public-key', protect, requireTenant, getPublicKey);
router.post('/admin-weekly-report', protect, requireTenant, admin, sendWeeklyReportReminder);
router.post('/subscribe', protect, requireTenant, subscribe);
router.delete('/subscribe', protect, requireTenant, unsubscribe);

module.exports = router;
