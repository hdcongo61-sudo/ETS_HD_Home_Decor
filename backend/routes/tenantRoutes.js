const express = require('express');
const router = express.Router();
const { protect, superAdmin } = require('../middlewares/authMiddleware');
const {
  registerTenant,
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  getMyTenant,
  impersonateTenant,
  exportTenantsCsv,
  getOverviewStats,
  recordPayment,
  getAuditLog,
  getPlans,
  updatePlans,
  getTenantStats,
} = require('../controllers/tenantController');

// ── Public ───────────────────────────────────────────────
router.post('/register', registerTenant);

// ── Authenticated (any tenant user) ─────────────────────
router.get('/me', protect, getMyTenant);

// ── Super-admin only ─────────────────────────────────────
// Static paths BEFORE '/:id' so they are not captured as an id.
router.get('/export/csv',     protect, superAdmin, exportTenantsCsv);
router.get('/stats/overview', protect, superAdmin, getOverviewStats);
router.get('/audit',          protect, superAdmin, getAuditLog);
router.get('/plans',          protect, superAdmin, getPlans);
router.put('/plans',          protect, superAdmin, updatePlans);
router.get('/',          protect, superAdmin, getTenants);
router.post('/',         protect, superAdmin, createTenant);
router.get('/:id/stats', protect, superAdmin, getTenantStats);
router.get('/:id',       protect, superAdmin, getTenantById);
router.put('/:id',       protect, superAdmin, updateTenant);
router.delete('/:id',    protect, superAdmin, deleteTenant);
router.post('/:id/impersonate', protect, superAdmin, impersonateTenant);
router.post('/:id/payment',     protect, superAdmin, recordPayment);

module.exports = router;
