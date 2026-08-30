const express = require('express');
const router = express.Router();
const { protect, requireTenant, admin } = require('../middlewares/authMiddleware');
const { getOverview, exportWeeklySummary } = require('../controllers/dashboardController');

router.get('/overview', protect, requireTenant, getOverview);
router.get('/export/weekly', protect, requireTenant, admin, exportWeeklySummary);

module.exports = router;
