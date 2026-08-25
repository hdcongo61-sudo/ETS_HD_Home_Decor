const express = require('express');
const router = express.Router();
const { protect, requireTenant } = require('../middlewares/authMiddleware');
const { getOverview } = require('../controllers/dashboardController');

router.get('/overview', protect, requireTenant, getOverview);

module.exports = router;
