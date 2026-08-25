const express = require('express');
const router = express.Router();
const {
  getBankTransactions,
  createBankTransaction
} = require('../controllers/bankController');
const { protect, requireTenant } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, requireTenant, getBankTransactions)
  .post(protect, requireTenant, createBankTransaction);

module.exports = router;
