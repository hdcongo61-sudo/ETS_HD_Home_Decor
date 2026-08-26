const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const { salesReport, inventoryReport } = require('../controllers/reportController');
const { createExport, listExports, getExport, downloadExport } = require('../controllers/exportJobController');

// Reporting paginé côté serveur (Phase 7.6).
router.get('/reports/sales', protect, requireTenant, requirePermission('reporting.view'), salesReport);
router.get('/reports/inventory', protect, requireTenant, resolveLocation, inventoryReport);

// Exports asynchrones (Phase 7.7).
router.post('/exports', protect, requireTenant, requirePermission('reporting.view'), createExport);
router.get('/exports', protect, requireTenant, listExports);
router.get('/exports/:id', protect, requireTenant, getExport);
router.get('/exports/:id/download', protect, requireTenant, downloadExport);

module.exports = router;
