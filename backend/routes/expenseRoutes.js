const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByDateRange
} = require('../controllers/expenseController');
const { protect, admin, adminOrPermission, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');

// Admins et membres avec la permission `use_expenses` (attribuée par un admin
// depuis la gestion des utilisateurs) peuvent consulter et saisir des dépenses.
router.route('/')
  .get(protect, requireTenant, adminOrPermission('use_expenses'), getExpenses)
  .post(protect, requireTenant, adminOrPermission('use_expenses'), resolveLocation, createExpense);

router.route('/date-range')
  .get(protect, requireTenant, getExpensesByDateRange);

// Modification et suppression : réservées aux administrateurs.
router.route('/:id')
  .delete(protect, requireTenant, admin, deleteExpense)
  .put(protect, requireTenant, admin, updateExpense);

module.exports = router;
