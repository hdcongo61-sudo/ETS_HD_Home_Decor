const express = require('express');
const router = express.Router();
const { protect, protectForBilling, admin, superAdmin, requireTenant } = require('../middlewares/authMiddleware');
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
  getPaymentInvoicePdf,
  getAuditLog,
  getPlans,
  updatePlans,
  getTenantStats,
  generateApiKey,
  getSystemHealth,
  getTenantDataUsage,
  recordTenantPresence,
} = require('../controllers/tenantController');
const {
  getPawaPayConfig,
  initiatePawaPayPayment,
  getPawaPayPaymentStatus,
  pawaPayWebhook,
} = require('../controllers/subscriptionPaymentController');
const {
  createAnnouncement,
  listAnnouncements,
  listMyAnnouncements,
  markAnnouncementRead,
} = require('../controllers/platformAnnouncementController');

// ── Public ───────────────────────────────────────────────
router.post('/register', registerTenant);
// PawaPay callback (no auth — verified via Content-Digest / RFC-9421 signature)
router.post('/payment/pawapay/webhook', pawaPayWebhook);

// ── Authenticated (any tenant user) ─────────────────────
router.get('/me', protect, getMyTenant);
router.post('/me/presence', protect, requireTenant, recordTenantPresence);
// Clé d'API publique — self-service (admin de la boutique).
router.post('/me/api-key', protect, admin, generateApiKey);
router.get('/plan-catalog', protect, getPlanCatalog);
router.post('/plan-request', protect, admin, requestPlanChange);

// ── Billing: available even when the shop is suspended/expired ──
router.get('/payment/pawapay/config',   protectForBilling, getPawaPayConfig);
router.post('/payment/pawapay/initiate', protectForBilling, admin, initiatePawaPayPayment);
router.get('/payment/pawapay/:depositId', protectForBilling, getPawaPayPaymentStatus);
router.get('/announcements/my', protect, requireTenant, listMyAnnouncements);
router.post('/announcements/:id/read', protect, requireTenant, markAnnouncementRead);

// ── Super-admin only ─────────────────────────────────────
// Static paths BEFORE '/:id' so they are not captured as an id.
router.get('/announcements', protect, superAdmin, listAnnouncements);
router.post('/announcements', protect, superAdmin, createAnnouncement);
router.get('/system/health', protect, superAdmin, getSystemHealth);
router.get('/data-usage', protect, superAdmin, getTenantDataUsage);
router.put('/:id/plan-request', protect, superAdmin, resolvePlanRequest);
router.post('/:id/api-key', protect, superAdmin, generateApiKey);
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
router.get('/:id/payment/:paymentId/invoice', protect, superAdmin, getPaymentInvoicePdf);

module.exports = router;
