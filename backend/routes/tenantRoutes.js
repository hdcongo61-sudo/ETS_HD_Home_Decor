const express = require('express');
const router = express.Router();
const { protect, protectForBilling, admin, superAdmin } = require('../middlewares/authMiddleware');
const {
  registerTenant,
  createTenant,
  getTenants,
  getPlanCatalog,
  requestPlanChange,
  resolvePlanRequest,
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
const {
  getPawaPayConfig,
  initiatePawaPayPayment,
  getPawaPayPaymentStatus,
  pawaPayWebhook,
} = require('../controllers/subscriptionPaymentController');

// ── Public ───────────────────────────────────────────────
router.post('/register', registerTenant);
// PawaPay callback (no auth — verified via Content-Digest / RFC-9421 signature)
router.post('/payment/pawapay/webhook', pawaPayWebhook);

// ── Authenticated (any tenant user) ─────────────────────
router.get('/me', protect, getMyTenant);
router.get('/plan-catalog', protect, getPlanCatalog);
router.post('/plan-request', protect, admin, requestPlanChange);

// ── Billing: available even when the shop is suspended/expired ──
router.get('/payment/pawapay/config',   protectForBilling, getPawaPayConfig);
router.post('/payment/pawapay/initiate', protectForBilling, admin, initiatePawaPayPayment);
router.get('/payment/pawapay/:depositId', protectForBilling, getPawaPayPaymentStatus);

// ── Super-admin only ─────────────────────────────────────
// Static paths BEFORE '/:id' so they are not captured as an id.
router.put('/:id/plan-request', protect, superAdmin, resolvePlanRequest);
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
