const express = require('express');
const router = express.Router();
const { protect, requireTenant, requirePermission } = require('../middlewares/authMiddleware');
const { uploadProducts, listImports, getImport, confirmImport, startImport } = require('../controllers/importController');

// Imports en étapes (Phase 7.8).
router.post('/imports/products', protect, requireTenant, requirePermission('catalog.manage'), uploadProducts);
router.get('/imports', protect, requireTenant, listImports);
router.get('/imports/:id', protect, requireTenant, getImport);
router.post('/imports/:id/confirm', protect, requireTenant, requirePermission('catalog.manage'), confirmImport);
router.post('/imports/:id/run', protect, requireTenant, requirePermission('catalog.manage'), startImport);

module.exports = router;
