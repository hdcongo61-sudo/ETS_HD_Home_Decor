const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByDateRange
} = require('../controllers/expenseController');
const { protect, adminOrPermission, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');

// Admins et membres avec la permission `use_expenses` (attribuée par un admin
// depuis la gestion des utilisateurs) peuvent gérer les dépenses.
router.route('/')
  .get(protect, requireTenant, adminOrPermission('use_expenses'), getExpenses)
  .post(protect, requireTenant, adminOrPermission('use_expenses'), resolveLocation, createExpense);

router.route('/date-range')
  .get(protect, requireTenant, getExpensesByDateRange);

router.route('/:id')
  .delete(protect, requireTenant, adminOrPermission('use_expenses'), deleteExpense)
  .put(protect, requireTenant, adminOrPermission('use_expenses'), updateExpense);

module.exports = router;
