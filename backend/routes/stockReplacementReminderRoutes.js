const express = require('express');
const router = express.Router();
const {
  getPendingStockReplacementReminders,
  confirmStockReplacementReminder,
} = require('../controllers/stockReplacementReminderController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/', protect, admin, getPendingStockReplacementReminders);
router.post('/:id/confirm', protect, admin, confirmStockReplacementReminder);

module.exports = router;
