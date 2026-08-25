const express = require('express');
const router = express.Router();
const {
  getPendingStockReplacementReminders,
  confirmStockReplacementReminder,
} = require('../controllers/stockReplacementReminderController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');

router.get('/', protect, requireTenant, admin, getPendingStockReplacementReminders);
router.post('/:id/confirm', protect, requireTenant, admin, confirmStockReplacementReminder);

module.exports = router;
