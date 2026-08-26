const express = require('express');
const router = express.Router();
const { protect, requireTenant, requirePermission } = require('../middlewares/authMiddleware');
const { getFlags, setFlag, archiveReport, listReports, getReport, getDeprecations } = require('../controllers/cutoverController');

// Registre de dépréciation des routes (Phase 8.5).
router.get('/deprecations', protect, requireTenant, getDeprecations);

// Drapeaux de bascule par organisation (Phase 8.2).
router.get('/flags', protect, requireTenant, getFlags);
router.put('/flags/:key', protect, requireTenant, requirePermission('organization.manage'), setFlag);

// Rapport de réconciliation final archivé (Phase 8.7).
router.post('/cutover/report', protect, requireTenant, requirePermission('organization.manage'), archiveReport);
router.get('/cutover/reports', protect, requireTenant, listReports);
router.get('/cutover/reports/:id', protect, requireTenant, getReport);

module.exports = router;
