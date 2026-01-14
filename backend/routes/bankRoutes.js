const express = require('express');
const router = express.Router();
const {
  getBankTransactions,
  createBankTransaction
} = require('../controllers/bankController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getBankTransactions)
  .post(protect, createBankTransaction);

module.exports = router;
