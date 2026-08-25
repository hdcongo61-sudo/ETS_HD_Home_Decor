const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getOverview } = require('../controllers/dashboardController');

router.get('/overview', protect, getOverview);

module.exports = router;
