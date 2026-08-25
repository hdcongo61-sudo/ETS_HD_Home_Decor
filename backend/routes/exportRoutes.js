// routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const { generateSalesReport } = require('../controllers/exportController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');

router.get('/sales-export', protect, requireTenant, admin, generateSalesReport);

module.exports = router;