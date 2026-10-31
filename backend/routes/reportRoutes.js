const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission, admin } = require('../middlewares/authMiddleware');
const { salesReport, inventoryReport, vatDeclarationCsv, payrollSummaryCsv } = require('../controllers/reportController');
const { createExport, listExports, getExport, downloadExport } = require('../controllers/exportJobController');

// Reporting paginé côté serveur (Phase 7.6).
router.get('/reports/sales', protect, requireTenant, requirePermission('reporting.view'), salesReport);
router.get('/reports/inventory', protect, requireTenant, resolveLocation, inventoryReport);

// Exports de conformité (CSV) — admin only.
router.get('/reports/vat-declaration', protect, requireTenant, admin, vatDeclarationCsv);
router.get('/reports/payroll-summary', protect, requireTenant, admin, payrollSummaryCsv);

// Exports asynchrones (Phase 7.7).
router.post('/exports', protect, requireTenant, requirePermission('reporting.view'), createExport);
router.get('/exports', protect, requireTenant, listExports);
router.get('/exports/:id', protect, requireTenant, getExport);
// Téléchargement par jeton aléatoire — pas d'en-tête Bearer nécessaire.
router.get('/exports/:id/download', downloadExport);

module.exports = router;
