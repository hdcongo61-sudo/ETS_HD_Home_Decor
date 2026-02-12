const express = require('express');
const router = express.Router();
const {
  getCategories, createCategory, updateCategory, deleteCategory,
  getContainers, createContainer, updateContainer, deleteContainer,
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
} = require('../controllers/lookupController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Categories
router.route('/categories')
  .get(protect, getCategories)
  .post(protect, admin, createCategory);
router.route('/categories/:id')
  .put(protect, admin, updateCategory)
  .delete(protect, admin, deleteCategory);

// Containers
router.route('/containers')
  .get(protect, getContainers)
  .post(protect, admin, createContainer);
router.route('/containers/:id')
  .put(protect, admin, updateContainer)
  .delete(protect, admin, deleteContainer);

// Warehouses
router.route('/warehouses')
  .get(protect, getWarehouses)
  .post(protect, admin, createWarehouse);
router.route('/warehouses/:id')
  .put(protect, admin, updateWarehouse)
  .delete(protect, admin, deleteWarehouse);

// Suppliers
router.route('/suppliers')
  .get(protect, getSuppliers)
  .post(protect, admin, createSupplier);
router.route('/suppliers/:id')
  .put(protect, admin, updateSupplier)
  .delete(protect, admin, deleteSupplier);

module.exports = router;
