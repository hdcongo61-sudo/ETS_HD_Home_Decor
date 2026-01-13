const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const {
  createSale,
  addPayment,
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


// Nouvelles routes pour l'analyse des bénéfices
router.route('/profit-analytics').get(protect, getProfitAnalytics);
router.route('/profit-report').get(protect, getProfitReport);

router.route('/user/:userId')
  .get(protect, getUserSales)
// Main sales routes
router.route('/')
  .get(protect, getSales)          // GET /api/sales (with optional query params)
  .post(protect, createSale);

// Deleted sales history
router.get('/deleted', protect, admin, getDeletedSales);

// Get upcoming reminders
router.get('/reminders/upcoming', protect,getUpcomingReminders);

// Send reminder
router.post('/:id/send-reminder',protect, sendReminder);

// Update reminder
router.put('/:id/reminder',protect, updateReminder);
router.delete('/:id/reminder', protect, deleteReminder);

router.put('/:id/delivery', protect, updateDelivery);
router.get('/stats/delivery', protect, getDeliveryStats);
// POST /api/sales
router.route('/user-stats')
  .get(protect, getUserSalesStats);
// Dashboard route
router.route('/dashboard-sale')
  .get(protect, admin, getDashboardData); // GET /api/sales/dashboard

router.route('/best-days')
  .get(protect, admin, getBestDays);

// Payment routes
router.route('/:id/payments')
  .post(protect, addPayment);      // POST /api/sales/:id/payments
// Date range route
router.route('/date-range')
  .get(protect, getSalesByDateRange);   // GET /api/sales/date-range

// Payments by date range route
router.route('/payments/date-range')
  .get(protect, getPaymentsByDateRange);
// Statistics route
router.route('/stats')
  .get(protect, admin, getSalesStats);

router.get('/sales/stats/status', protect, admin,getSalesStatsByStatus);

router.route('/:id')
  .put(protect, admin, updateSale)
  .delete(protect, admin, deleteSale);


// GET /api/sales/stats
router.route('/:id').get(protect, getSaleById);

// GET /api/sales/date-range

// New client purchases route
router.route('/client/:clientId')
  .get(protect, getClientPurchases);    // GET /api/sales/client/:clientId

router.delete(
  '/:saleId/payments/:paymentId',
  protect,
  admin,
  deletePayment
);




module.exports = router;
