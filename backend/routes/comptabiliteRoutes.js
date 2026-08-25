const express = require('express');
const router = express.Router();
const {
  getAccountingSummary,
  getJournal,
} = require('../controllers/comptabiliteController');
const { protect, requireTenant } = require('../middlewares/authMiddleware');

router.get('/summary', protect, requireTenant, getAccountingSummary);
router.get('/journal', protect, requireTenant, getJournal);

module.exports = router;
