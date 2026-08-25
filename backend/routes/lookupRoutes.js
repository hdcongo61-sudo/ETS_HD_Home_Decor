const express = require('express');
const router = express.Router();
const {
  getCategories, getCategoriesTree, createCategory, updateCategory, deleteCategory,
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getContainers, createContainer, updateContainer, deleteContainer,
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
} = require('../controllers/lookupController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');

// Categories
router.route('/categories')
  .get(protect, requireTenant, getCategories)
  .post(protect, requireTenant, admin, createCategory);
// Arborescence complète (Phase 3) — déclarée avant /:id.
router.get('/categories/tree', protect, requireTenant, getCategoriesTree);
router.route('/categories/:id')
  .put(protect, requireTenant, admin, updateCategory)
  .delete(protect, requireTenant, admin, deleteCategory);

// Expense categories
router.route('/expense-categories')
  .get(protect, requireTenant, getExpenseCategories)
  .post(protect, requireTenant, admin, createExpenseCategory);
router.route('/expense-categories/:id')
  .put(protect, requireTenant, admin, updateExpenseCategory)
  .delete(protect, requireTenant, admin, deleteExpenseCategory);

// Containers
router.route('/containers')
  .get(protect, requireTenant, getContainers)
  .post(protect, requireTenant, admin, createContainer);
router.route('/containers/:id')
  .put(protect, requireTenant, admin, updateContainer)
  .delete(protect, requireTenant, admin, deleteContainer);

// Warehouses
router.route('/warehouses')
  .get(protect, requireTenant, getWarehouses)
  .post(protect, requireTenant, admin, createWarehouse);
router.route('/warehouses/:id')
  .put(protect, requireTenant, admin, updateWarehouse)
  .delete(protect, requireTenant, admin, deleteWarehouse);

// Suppliers
router.route('/suppliers')
  .get(protect, requireTenant, getSuppliers)
  .post(protect, requireTenant, admin, createSupplier);
router.route('/suppliers/:id')
  .put(protect, requireTenant, admin, updateSupplier)
  .delete(protect, requireTenant, admin, deleteSupplier);

module.exports = router;
