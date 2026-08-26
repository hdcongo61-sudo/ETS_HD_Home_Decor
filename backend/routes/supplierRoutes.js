const express = require('express');
const router = express.Router();
const { protect, requireTenant, requirePermission } = require('../middlewares/authMiddleware');
const {
  getSuppliers, getSupplier, createSupplier, updateSupplier,
  getSupplierProducts, createSupplierProduct, updateSupplierProduct, deleteSupplierProduct,
} = require('../controllers/supplierController');

// Fournisseurs (Phase 6.1).
router.get('/suppliers', protect, requireTenant, getSuppliers);
router.get('/suppliers/:id', protect, requireTenant, getSupplier);
router.post('/suppliers', protect, requireTenant, requirePermission('purchasing.manage'), createSupplier);
router.put('/suppliers/:id', protect, requireTenant, requirePermission('purchasing.manage'), updateSupplier);

// Références d'achat fournisseur↔produit (Phase 6.2).
router.get('/supplier-products', protect, requireTenant, getSupplierProducts);
router.post('/supplier-products', protect, requireTenant, requirePermission('purchasing.manage'), createSupplierProduct);
router.put('/supplier-products/:id', protect, requireTenant, requirePermission('purchasing.manage'), updateSupplierProduct);
router.delete('/supplier-products/:id', protect, requireTenant, requirePermission('purchasing.manage'), deleteSupplierProduct);

module.exports = router;
