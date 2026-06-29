const express = require('express');
const router = express.Router();
const {
  getAccountingSummary,
  getJournal,
} = require('../controllers/comptabiliteController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/summary', protect, getAccountingSummary);
router.get('/journal', protect, getJournal);

module.exports = router;
