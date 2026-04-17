const express = require('express');
const router = express.Router();
const {
  getPublicKey,
  sendWeeklyReportReminder,
  subscribe,
  unsubscribe
} = require('../controllers/notificationController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/public-key', protect, getPublicKey);
router.post('/admin-weekly-report', protect, admin, sendWeeklyReportReminder);
router.post('/subscribe', protect, subscribe);
router.delete('/subscribe', protect, unsubscribe);

module.exports = router;
