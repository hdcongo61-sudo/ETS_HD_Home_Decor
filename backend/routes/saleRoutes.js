const express = require('express');
const router = express.Router();
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const {
  createSale,
  addPayment,
  recordReminder,
  getSales,
  getSalesStats,
  getSalesByDateRange,
  getClientPurchases,
  getUserSales,
  getSaleById,
  getUserSalesStats,
  updateSale,
  deleteSale,
  getDeletedSales,
  getSalesStatsByStatus,
  deletePayment,
  getPaymentsByDateRange,
  getUpcomingReminders,
  sendReminder,
  updateReminder,
  deleteReminder,
  getDeliveryStats,
  updateDelivery,
  getDashboardData,
  getBestDays
} = require('../controllers/saleController');
const { getProfitAnalytics, getProfitReport } = require('../controllers/profitController');
const { requireFeature } = require('../middlewares/featureMiddleware');
const { FEATURE_KEYS } = require('../config/features');


// Nouvelles routes pour l'analyse des bénéfices (forfait Entreprise)
router.route('/profit-analytics').get(protect, requireTenant, requireFeature(FEATURE_KEYS.PROFIT_ANALYSIS), getProfitAnalytics);
router.route('/profit-report').get(protect, requireTenant, requireFeature(FEATURE_KEYS.PROFIT_ANALYSIS), getProfitReport);

router.route('/user/:userId')
  .get(protect, requireTenant, getUserSales)
// Main sales routes
router.route('/')
  .get(protect, requireTenant, getSales)          // GET /api/sales (with optional query params)
  .post(protect, requireTenant, createSale);

// Deleted sales history
router.get('/deleted', protect, requireTenant, admin, getDeletedSales);

// Get upcoming reminders
router.get('/reminders/upcoming', protect, requireTenant, getUpcomingReminders);

// Send reminder
router.post('/:id/send-reminder', protect, requireTenant, sendReminder);

// Update reminder
router.put('/:id/reminder', protect, requireTenant, updateReminder);
router.delete('/:id/reminder', protect, requireTenant, deleteReminder);

router.put('/:id/delivery', protect, requireTenant, updateDelivery);
router.get('/stats/delivery', protect, requireTenant, getDeliveryStats);
// POST /api/sales
router.route('/user-stats')
  .get(protect, requireTenant, admin, getUserSalesStats);
// Dashboard route
router.route('/dashboard-sale')
  .get(protect, requireTenant, admin, getDashboardData); // GET /api/sales/dashboard

router.route('/best-days')
  .get(protect, requireTenant, admin, getBestDays);

// Payment routes
router.route('/:id/payments')
  .post(protect, requireTenant, addPayment);      // POST /api/sales/:id/payments

router.post('/:id/remind', protect, requireTenant, recordReminder); // Log a collection follow-up
// Date range route
router.route('/date-range')
  .get(protect, requireTenant, getSalesByDateRange);   // GET /api/sales/date-range

// Payments by date range route
router.route('/payments/date-range')
  .get(protect, requireTenant, getPaymentsByDateRange);
// Statistics route
router.route('/stats')
  .get(protect, requireTenant, admin, getSalesStats);

router.get('/stats/status', protect, requireTenant, admin, getSalesStatsByStatus);
router.get('/sales/stats/status', protect, requireTenant, admin, getSalesStatsByStatus);

router.route('/:id')
  .put(protect, requireTenant, admin, updateSale)
  .delete(protect, requireTenant, admin, deleteSale);


// GET /api/sales/stats
router.route('/:id').get(protect, requireTenant, getSaleById);

// GET /api/sales/date-range

// New client purchases route
router.route('/client/:clientId')
  .get(protect, requireTenant, getClientPurchases);    // GET /api/sales/client/:clientId

router.delete(
  '/:saleId/payments/:paymentId',
  protect,
  requireTenant,
  admin,
  deletePayment
);




module.exports = router;
