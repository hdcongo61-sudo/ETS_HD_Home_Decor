const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByDateRange
} = require('../controllers/expenseController');
const { protect, admin, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, requireTenant, admin, getExpenses)
  .post(protect, requireTenant, admin, resolveLocation, createExpense);

router.route('/date-range')
  .get(protect, requireTenant, getExpensesByDateRange);

router.route('/:id')
  .delete(protect, requireTenant, admin, deleteExpense)
  .put(protect, requireTenant, admin, updateExpense);

module.exports = router;
