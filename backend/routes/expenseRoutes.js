const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByDateRange
} = require('../controllers/expenseController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, admin, getExpenses)
  .post(protect, admin,createExpense);

router.route('/date-range')
  .get(protect, getExpensesByDateRange);

router.route('/:id')
  .delete(protect, admin, deleteExpense)
  .put(protect, admin, updateExpense);

module.exports = router;
